import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { dataTestIds } from 'src/constants/data-test-ids';
import { SCHOOL_NOTE_CODE, WORK_NOTE_CODE } from 'utils/lib/types/api/chart-data/chart-data.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The dialog now drives three outcomes off one set of checkboxes — print, discharge and sign — so
// what is under test is which of those it runs, in what order, and how it labels the action.
// Whether the note *may* be signed is useProgressNoteSigning's job and is mocked out here.

const signNote = vi.fn().mockResolvedValue(undefined);
const appointmentRefetch = vi.fn().mockResolvedValue(undefined);
const downloadDocument = vi.fn().mockResolvedValue(undefined);
const createAndOpenDischargeSummary = vi.fn().mockResolvedValue(undefined);
const handleDischarge = vi.fn().mockResolvedValue(undefined);
const enqueueSnackbar = vi.fn();

vi.mock('notistack', () => ({
  enqueueSnackbar: (...args: unknown[]) => enqueueSnackbar(...args),
}));

let signing = {
  completed: false,
  permissionMessages: [] as string[],
  readinessMessages: [] as string[],
  supervisorApprovalApplies: true,
  isSigning: false,
  signNote,
};

// Which notes the visit has comes from the chart; their presigned URLs arrive separately and later.
let schoolWorkNotes: { type: string; url: string }[] = [];
let presignedFiles: { type: string; presignedUrl: string }[] = [];

vi.mock('src/features/visits/shared/hooks/useProgressNoteSigning', () => ({
  useProgressNoteSigning: () => signing,
}));

vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ appointmentRefetch }),
  useChartData: () => ({ chartData: { schoolWorkNotes } }),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: {} }),
}));

vi.mock('src/hooks/useGetPatientDocs', () => ({
  useGetPatientDocs: () => ({ downloadDocument }),
}));

vi.mock('src/shared/hooks/useExcusePresignedFiles', () => ({
  useExcusePresignedFiles: () => presignedFiles,
}));

vi.mock('src/features/visits/shared/components/review-tab/DischargeButton', () => ({
  createAndOpenDischargeSummary: (...args: unknown[]) => createAndOpenDischargeSummary(...args),
  handleDischarge: (...args: unknown[]) => handleDischarge(...args),
}));

import { DischargeDialog } from '../../src/features/visits/shared/components/review-tab/DischargeDialog';

const baseProps = {
  onClose: vi.fn(),
  encounterId: 'encounter-1',
  appointmentId: 'appointment-1',
  patientId: 'patient-1',
};

const checkbox = (testId: string): HTMLInputElement =>
  screen.getByTestId(testId).querySelector('input') as HTMLInputElement;

const confirmButton = (): HTMLElement => screen.getByTestId(dataTestIds.dischargeDialog.confirmButton);

describe('DischargeDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signing = {
      completed: false,
      permissionMessages: [],
      readinessMessages: [],
      supervisorApprovalApplies: true,
      isSigning: false,
      signNote,
    };
    schoolWorkNotes = [
      { type: WORK_NOTE_CODE, url: 'z3://work-note' },
      { type: SCHOOL_NOTE_CODE, url: 'z3://school-note' },
    ];
    presignedFiles = [
      { type: WORK_NOTE_CODE, presignedUrl: 'https://example.test/work-note' },
      { type: SCHOOL_NOTE_CODE, presignedUrl: 'https://example.test/school-note' },
    ];
    vi.stubGlobal('open', vi.fn());
  });

  it('labels the action for the current selection', async () => {
    const user = userEvent.setup();
    render(<DischargeDialog {...baseProps} />);

    expect(confirmButton()).toHaveTextContent('Discharge & Print');

    await user.click(checkbox(dataTestIds.dischargeDialog.signProgressNoteCheckbox));
    expect(confirmButton()).toHaveTextContent('Discharge, Print & Sign');

    await user.click(checkbox(dataTestIds.dischargeDialog.printDischargeSummaryCheckbox));
    await user.click(checkbox(dataTestIds.dischargeDialog.printWorkNoteCheckbox));
    await user.click(checkbox(dataTestIds.dischargeDialog.printSchoolNoteCheckbox));
    expect(confirmButton()).toHaveTextContent('Discharge & Sign');

    await user.click(checkbox(dataTestIds.dischargeDialog.signProgressNoteCheckbox));
    expect(confirmButton()).toHaveTextContent('Discharge');
  });

  it('holds supervisor approval closed until the note is being signed', async () => {
    const user = userEvent.setup();
    render(<DischargeDialog {...baseProps} />);

    const supervisorApproval = checkbox(dataTestIds.dischargeDialog.supervisorApprovalCheckbox);
    expect(supervisorApproval).toBeDisabled();
    expect(supervisorApproval).not.toBeChecked();

    await user.click(checkbox(dataTestIds.dischargeDialog.signProgressNoteCheckbox));
    expect(supervisorApproval).toBeEnabled();
    expect(supervisorApproval).toBeChecked();
  });

  it('hides the supervisor option for a practitioner it does not apply to', () => {
    signing = { ...signing, supervisorApprovalApplies: false };
    render(<DischargeDialog {...baseProps} />);

    expect(screen.queryByTestId(dataTestIds.dischargeDialog.supervisorApprovalCheckbox)).not.toBeInTheDocument();
  });

  it('blocks signing and says why when the note is not ready', () => {
    signing = { ...signing, readinessMessages: ['You need to fill in the missing data'] };
    render(<DischargeDialog {...baseProps} />);

    expect(checkbox(dataTestIds.dischargeDialog.signProgressNoteCheckbox)).toBeDisabled();
    expect(checkbox(dataTestIds.dischargeDialog.supervisorApprovalCheckbox)).toBeDisabled();
    expect(screen.getByTestId(dataTestIds.dischargeDialog.signDisabledReason)).toHaveTextContent(
      /missing required information on the Progress Note/i
    );
    expect(confirmButton()).toHaveTextContent('Discharge & Print');
  });

  it('reports a permission block in the signer’s own terms', () => {
    signing = { ...signing, permissionMessages: ['Your role cannot sign this note'] };
    render(<DischargeDialog {...baseProps} />);

    expect(screen.getByTestId(dataTestIds.dischargeDialog.signDisabledReason)).toHaveTextContent(
      'Your role cannot sign this note'
    );
  });

  it('prints, then discharges, then signs', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<DischargeDialog {...baseProps} onClose={onClose} />);

    await user.click(checkbox(dataTestIds.dischargeDialog.signProgressNoteCheckbox));
    await user.click(checkbox(dataTestIds.dischargeDialog.supervisorApprovalCheckbox));
    await user.click(confirmButton());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

    expect(createAndOpenDischargeSummary).toHaveBeenCalledWith({}, 'appointment-1', downloadDocument, {
      skipRelated: true,
    });
    expect(window.open).toHaveBeenCalledWith('https://example.test/work-note', '_blank');
    expect(window.open).toHaveBeenCalledWith('https://example.test/school-note', '_blank');
    expect(handleDischarge).toHaveBeenCalledWith('encounter-1', {});
    expect(signNote).toHaveBeenCalledWith({ requireSupervisorApproval: false });

    expect(createAndOpenDischargeSummary.mock.invocationCallOrder[0]).toBeLessThan(
      handleDischarge.mock.invocationCallOrder[0]
    );
    expect(handleDischarge.mock.invocationCallOrder[0]).toBeLessThan(signNote.mock.invocationCallOrder[0]);
    // signNote refreshes the appointment itself, so the dialog does not fetch it a second time.
    expect(appointmentRefetch).not.toHaveBeenCalled();
  });

  it('discharges alone when nothing is selected', async () => {
    const user = userEvent.setup();
    render(<DischargeDialog {...baseProps} />);

    await user.click(checkbox(dataTestIds.dischargeDialog.printDischargeSummaryCheckbox));
    await user.click(checkbox(dataTestIds.dischargeDialog.printWorkNoteCheckbox));
    await user.click(checkbox(dataTestIds.dischargeDialog.printSchoolNoteCheckbox));
    await user.click(confirmButton());

    await waitFor(() => expect(handleDischarge).toHaveBeenCalledTimes(1));
    expect(createAndOpenDischargeSummary).not.toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
    expect(signNote).not.toHaveBeenCalled();
    expect(appointmentRefetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the dialog open when the discharge fails', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    handleDischarge.mockRejectedValueOnce(new Error('discharge failed'));
    render(<DischargeDialog {...baseProps} onClose={onClose} />);

    await user.click(checkbox(dataTestIds.dischargeDialog.signProgressNoteCheckbox));
    await user.click(confirmButton());

    await waitFor(() => expect(handleDischarge).toHaveBeenCalledTimes(1));
    // Signing a visit that was never discharged would be rejected by the zambda anyway, and the
    // dialog has to stay put so the staff member can retry rather than lose the selection.
    expect(signNote).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(confirmButton()).toBeEnabled();
    expect(enqueueSnackbar).toHaveBeenCalledWith('An error occurred. Please try again.', { variant: 'error' });
  });

  it('keeps the dialog open when signing fails after a successful discharge', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    signNote.mockRejectedValueOnce(new Error('sign failed'));
    render(<DischargeDialog {...baseProps} onClose={onClose} />);

    await user.click(checkbox(dataTestIds.dischargeDialog.signProgressNoteCheckbox));
    await user.click(confirmButton());

    await waitFor(() => expect(signNote).toHaveBeenCalledTimes(1));
    expect(handleDischarge).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(enqueueSnackbar).toHaveBeenCalledWith('An error occurred. Please try again.', { variant: 'error' });
  });

  it('greys out a document the visit does not have', () => {
    schoolWorkNotes = [];
    presignedFiles = [];
    render(<DischargeDialog {...baseProps} />);

    expect(checkbox(dataTestIds.dischargeDialog.printWorkNoteCheckbox)).toBeDisabled();
    expect(checkbox(dataTestIds.dischargeDialog.printWorkNoteCheckbox)).not.toBeChecked();
    expect(checkbox(dataTestIds.dischargeDialog.printSchoolNoteCheckbox)).toBeDisabled();
  });

  // A note's presigned URL arrives after the chart data. Gating the checkbox on the URL made a visit
  // that has a work note look exactly like one that has none for the first instants after opening.
  it('offers a note the visit has before its presigned URL arrives', () => {
    presignedFiles = [];
    render(<DischargeDialog {...baseProps} />);

    expect(checkbox(dataTestIds.dischargeDialog.printWorkNoteCheckbox)).toBeEnabled();
    expect(checkbox(dataTestIds.dischargeDialog.printWorkNoteCheckbox)).toBeChecked();
    expect(checkbox(dataTestIds.dischargeDialog.printSchoolNoteCheckbox)).toBeEnabled();
  });

  // Discharging without a selected note would strand it: DischargeButton drops the dropdown once the
  // visit is discharged, so this dialog could never be reopened to print it.
  it('will not discharge while a selected note is still being prepared', async () => {
    presignedFiles = [{ type: SCHOOL_NOTE_CODE, presignedUrl: 'https://example.test/school-note' }];
    const user = userEvent.setup();
    const { rerender } = render(<DischargeDialog {...baseProps} />);

    expect(confirmButton()).toBeDisabled();
    expect(screen.getByText('Preparing…')).toBeInTheDocument();

    // fireEvent rather than user.click: the button is genuinely disabled, so this asserts the click
    // cannot get through at all rather than that the pointer-events guard stopped it.
    fireEvent.click(confirmButton());
    expect(handleDischarge).not.toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();

    presignedFiles = [
      { type: WORK_NOTE_CODE, presignedUrl: 'https://example.test/work-note' },
      { type: SCHOOL_NOTE_CODE, presignedUrl: 'https://example.test/school-note' },
    ];
    rerender(<DischargeDialog {...baseProps} />);

    expect(confirmButton()).toBeEnabled();
    await user.click(confirmButton());

    await waitFor(() => expect(handleDischarge).toHaveBeenCalledTimes(1));
    expect(window.open).toHaveBeenCalledWith('https://example.test/work-note', '_blank');
    expect(window.open).toHaveBeenCalledWith('https://example.test/school-note', '_blank');
  });

  // The escape hatch when a note's URL never arrives: clearing it releases the confirm button, so a
  // permanently failing presign cannot deadlock the dialog.
  it('releases the confirm button when the unready note is cleared', async () => {
    presignedFiles = [{ type: SCHOOL_NOTE_CODE, presignedUrl: 'https://example.test/school-note' }];
    const user = userEvent.setup();
    render(<DischargeDialog {...baseProps} />);

    expect(confirmButton()).toBeDisabled();

    await user.click(checkbox(dataTestIds.dischargeDialog.printWorkNoteCheckbox));

    expect(confirmButton()).toBeEnabled();
    await user.click(confirmButton());

    await waitFor(() => expect(handleDischarge).toHaveBeenCalledTimes(1));
    expect(window.open).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledWith('https://example.test/school-note', '_blank');
  });

  it('does not repeat print or discharge when a retry follows a signing failure', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    signNote.mockRejectedValueOnce(new Error('sign failed'));
    render(<DischargeDialog {...baseProps} onClose={onClose} />);

    await user.click(checkbox(dataTestIds.dischargeDialog.signProgressNoteCheckbox));
    await user.click(confirmButton());
    await waitFor(() => expect(signNote).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(confirmButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

    // The summary was filed and the patient discharged on the first attempt; only signing was retried.
    expect(createAndOpenDischargeSummary).toHaveBeenCalledTimes(1);
    expect(handleDischarge).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledTimes(2);
    expect(signNote).toHaveBeenCalledTimes(2);
  });

  it('still prints a document ticked only after the first attempt failed', async () => {
    const user = userEvent.setup();
    signNote.mockRejectedValueOnce(new Error('sign failed'));
    render(<DischargeDialog {...baseProps} />);

    await user.click(checkbox(dataTestIds.dischargeDialog.printSchoolNoteCheckbox));
    await user.click(checkbox(dataTestIds.dischargeDialog.signProgressNoteCheckbox));
    await user.click(confirmButton());
    await waitFor(() => expect(signNote).toHaveBeenCalledTimes(1));
    expect(window.open).not.toHaveBeenCalledWith('https://example.test/school-note', '_blank');

    await user.click(checkbox(dataTestIds.dischargeDialog.printSchoolNoteCheckbox));
    await user.click(confirmButton());

    await waitFor(() => expect(window.open).toHaveBeenCalledWith('https://example.test/school-note', '_blank'));
    expect(handleDischarge).toHaveBeenCalledTimes(1);
  });

  it('refuses to be dismissed while the workflow is running', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    let releaseDischarge = (): void => undefined;
    handleDischarge.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        releaseDischarge = resolve;
      })
    );
    render(<DischargeDialog {...baseProps} onClose={onClose} />);

    await user.click(confirmButton());
    await waitFor(() => expect(handleDischarge).toHaveBeenCalledTimes(1));

    // The workflow keeps running after an unmount, so every dismissal route has to be shut off.
    expect(screen.queryByTestId(dataTestIds.dialog.closeButton)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();

    releaseDischarge();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('drops a sign selection that becomes impossible while the dialog is open', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DischargeDialog {...baseProps} />);

    await user.click(checkbox(dataTestIds.dischargeDialog.signProgressNoteCheckbox));
    expect(confirmButton()).toHaveTextContent('Discharge, Print & Sign');

    signing = { ...signing, readinessMessages: ['You need to fill in the missing data'] };
    rerender(<DischargeDialog {...baseProps} />);

    expect(checkbox(dataTestIds.dischargeDialog.signProgressNoteCheckbox)).not.toBeChecked();
    expect(screen.getByTestId(dataTestIds.dischargeDialog.signDisabledReason)).toBeInTheDocument();
    expect(confirmButton()).toHaveTextContent('Discharge & Print');

    await user.click(confirmButton());
    await waitFor(() => expect(handleDischarge).toHaveBeenCalledTimes(1));
    expect(signNote).not.toHaveBeenCalled();
  });

  // DischargeButton mounts the dialog only while it is open, so closing and reopening is a remount.
  it('starts from the default selection every time it is opened', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DischargeDialog {...baseProps} />);

    await user.click(checkbox(dataTestIds.dischargeDialog.printWorkNoteCheckbox));
    await user.click(checkbox(dataTestIds.dischargeDialog.signProgressNoteCheckbox));
    expect(confirmButton()).toHaveTextContent('Discharge, Print & Sign');

    unmount();
    render(<DischargeDialog {...baseProps} />);

    expect(checkbox(dataTestIds.dischargeDialog.printWorkNoteCheckbox)).toBeChecked();
    expect(checkbox(dataTestIds.dischargeDialog.signProgressNoteCheckbox)).not.toBeChecked();
    expect(confirmButton()).toHaveTextContent('Discharge & Print');
  });
});
