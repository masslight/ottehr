import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { EHRVisitDetails } from 'utils/lib/types/data/visit-details.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfirmSave } from '../../src/features/visits/shared/components/patient/SaveConfirmationContext';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn(), useParams: () => ({ id: 'appointment-1' }) };
});

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehr: undefined, oystehrZambda: {} }),
}));

const snackbarMock = vi.fn();
vi.mock('notistack', async () => {
  const actual = await vi.importActual<typeof import('notistack')>('notistack');
  return { ...actual, enqueueSnackbar: (...args: unknown[]) => snackbarMock(...args) };
});

const { getPatientVisitDetailsMock, updatePatientVisitDetailsMock } = vi.hoisted(() => ({
  getPatientVisitDetailsMock: vi.fn(),
  updatePatientVisitDetailsMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('src/api/api', () => ({
  getPatientVisitDetails: (...args: unknown[]) => getPatientVisitDetailsMock(...args),
  updatePatientVisitDetails: (...args: unknown[]) => updatePatientVisitDetailsMock(...args),
  getVisitFaxHistory: vi.fn().mockResolvedValue({ faxesSent: [] }),
  listServiceCategories: vi.fn().mockResolvedValue({ serviceCategories: [] }),
  generatePaperworkPdf: vi.fn(),
  getOrCreateVisitDetailsPdf: vi.fn(),
}));

// Whether the patient signed consent in their paperwork, which is what the "Completed consent
// forms" block reports as Signed/Not signed. Set per test before rendering.
const { consentPdfUrlsMock, imagesLoadingMock } = vi.hoisted(() => ({
  consentPdfUrlsMock: { current: [] as string[] },
  imagesLoadingMock: { current: false },
}));

vi.mock('src/hooks/useVisitCards', () => ({
  useVisitCards: () => ({
    imagesLoading: imagesLoadingMock.current,
    refetchFileData: vi.fn(),
    consentPdfUrls: consentPdfUrlsMock.current,
    idCards: { front: null, frontId: null, back: null, backId: null },
    primaryInsuranceCards: { front: null, frontId: null, back: null, backId: null },
    secondaryInsuranceCards: { front: null, frontId: null, back: null, backId: null },
    filesMutation: { mutateAsync: vi.fn() },
    uploadingFileType: null,
    deletingFileId: null,
    handleDeleteClick: vi.fn(),
    scannerModalOpen: false,
    setScannerModalOpen: vi.fn(),
    handleOpenScanner: vi.fn(),
    handleScanComplete: vi.fn(),
  }),
}));

vi.mock('src/hooks/useGetPatient', () => ({
  useGetPatientAccount: () => ({ data: undefined, isFetching: false }),
  useGetPatientCoverages: () => ({ data: undefined, isFetching: false }),
  useGetPatient: () => ({ otherPatientsWithSameName: false, setOtherPatientsWithSameName: vi.fn() }),
}));

vi.mock('src/hooks/useGetPatientBalances', () => ({
  useGetPatientBalances: () => ({ data: undefined, isLoading: false, refetch: vi.fn() }),
}));

vi.mock('src/hooks/useGetPatientDocs', () => ({
  useGetPatientDocs: () => ({ isLoadingDocuments: false, downloadDocument: vi.fn() }),
}));

vi.mock('src/hooks/useGetPatientPaymentsList', () => ({
  useGetPatientPaymentsList: () => ({ data: undefined, refetch: vi.fn(), isRefetching: false, error: null }),
}));

vi.mock('src/hooks/useEvolveUser', () => ({ default: () => ({ id: 'user-1', name: 'Test User' }) }));

vi.mock('src/helpers/activityLogsUtils', async () => {
  const actual = await vi.importActual<typeof import('src/helpers/activityLogsUtils')>('src/helpers/activityLogsUtils');
  return { ...actual, getAppointmentAndPatientHistory: vi.fn().mockResolvedValue(undefined) };
});

// Stands in for every Save button in the "About this patient" section: they all route their write
// through the guard the page hands down, so one button driving it exercises the same wiring.
const { patientRecordSaveMock, confirmSaveRef } = vi.hoisted(() => ({
  patientRecordSaveMock: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  // The guard itself, captured so a test can drive two saves into it concurrently - something no
  // amount of clicking can do once the modal is up.
  confirmSaveRef: { current: undefined as ConfirmSave | undefined },
}));

vi.mock('src/pages/PatientInformationPage', () => ({
  PatientAccountComponent: ({ confirmSave }: { confirmSave?: ConfirmSave }) => {
    confirmSaveRef.current = confirmSave;
    return (
      <button
        data-testid="save-patient-record"
        onClick={() => void (confirmSave ? confirmSave(patientRecordSaveMock) : patientRecordSaveMock())}
      >
        Save All
      </button>
    );
  },
}));

vi.mock('src/layout/PageContainer', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));

// Child blocks that fetch or render their own heavy trees; irrelevant to the consent reminder.
vi.mock('src/components/CardThumbnail', () => ({ default: () => <div /> }));
vi.mock('src/components/PatientPaymentsList', () => ({ default: () => <div /> }));
vi.mock('src/components/AppointmentNotesHistory', () => ({ default: () => <div /> }));
vi.mock('src/components/dialogs/ActivityLogDialog', () => ({ default: () => <div /> }));
vi.mock('src/components/ScannerModal', () => ({ ScannerModal: () => <div /> }));
// The visit page now embeds the documents explorer, whose hooks would
// otherwise have to be mocked wholesale. Not part of the consent reminder.
vi.mock('src/features/visits/shared/components/patient/docs/PatientDocumentsExplorer', () => ({
  PatientDocumentsExplorer: () => <div />,
}));

import { dataTestIds } from '../../src/constants/data-test-ids';
import VisitDetailsPage from '../../src/pages/VisitDetailsPage';

// ============================================================================
// HARNESS
// ============================================================================

const CONSENT_REMINDER_MESSAGE =
  "Consent forms are not yet signed for this encounter. Please verify consent and check the 'I verify that patient consent has been obtained.' checkbox before the patient is marked 'Ready'.";

const visitDetails = (consentIsAttested: boolean): EHRVisitDetails =>
  ({
    appointment: {
      resourceType: 'Appointment',
      id: 'appointment-1',
      status: 'arrived',
      start: '2026-08-19T15:00:00.000Z',
      appointmentType: { text: 'walk-in' },
      participant: [],
    },
    patient: { resourceType: 'Patient', id: 'patient-1', name: [{ given: ['Test'], family: 'Patient' }] },
    encounter: { resourceType: 'Encounter', id: 'encounter-1', status: 'in-progress' },
    flags: [],
    visitTimezone: 'America/New_York',
    qrId: 'qr-1',
    consentIsAttested,
    responsiblePartyName: null,
    responsiblePartyEmail: null,
    consentDetails: null,
  }) as unknown as EHRVisitDetails;

interface RenderOptions {
  consentIsAttested?: boolean;
  /** Consent signed by the patient in their paperwork. */
  patientSignedConsent?: boolean;
  /** Leaves the consent-files query in flight, which is what holds the checkbox unseeded. */
  filesStillLoading?: boolean;
}

const mountPage = ({
  consentIsAttested = false,
  patientSignedConsent = false,
  filesStillLoading = false,
}: RenderOptions = {}): void => {
  consentPdfUrlsMock.current = patientSignedConsent ? ['https://example.com/consent.pdf'] : [];
  imagesLoadingMock.current = filesStillLoading;
  getPatientVisitDetailsMock.mockResolvedValue(visitDetails(consentIsAttested));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <VisitDetailsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const renderPage = async (options: RenderOptions = {}): Promise<void> => {
  mountPage(options);
  await screen.findByText('I verify that patient consent has been obtained.');
};

// The test id sits on the checkbox's underlying input, so this is the real control, not MUI's wrapper.
const consentCheckbox = (): HTMLInputElement =>
  screen.getByTestId(dataTestIds.visitDetailsPage.consentAttestationCheckbox) as HTMLInputElement;

const consentSaveButton = (): HTMLElement =>
  screen.getByTestId(dataTestIds.visitDetailsPage.consentAttestationSaveButton);

const savePatientRecord = async (): Promise<void> => {
  await userEvent.click(screen.getByTestId('save-patient-record'));
};

const reminderDialog = (): HTMLElement | null =>
  screen.queryByTestId(dataTestIds.visitDetailsPage.consentReminderDialog);

beforeEach(() => {
  vi.clearAllMocks();
  updatePatientVisitDetailsMock.mockResolvedValue(undefined);
  patientRecordSaveMock.mockResolvedValue(undefined);
  imagesLoadingMock.current = false;
  confirmSaveRef.current = undefined;
});

// ============================================================================
// TESTS
// ============================================================================

describe('Visit details consent reminder', () => {
  it('reminds instead of blocking when the attestation is unchecked, and saves on confirm', async () => {
    await renderPage();

    expect(consentCheckbox()).not.toBeChecked();
    // The save button is live: an unattested consent is a warning, not a lock.
    expect(screen.getByTestId('save-patient-record')).toBeEnabled();

    await savePatientRecord();

    const dialog = await screen.findByTestId(dataTestIds.visitDetailsPage.consentReminderDialog);
    expect(dialog).toHaveTextContent('Reminder: consent not signed');
    expect(dialog).toHaveTextContent(CONSENT_REMINDER_MESSAGE);
    // Nothing is written while the reminder is up.
    expect(patientRecordSaveMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId(dataTestIds.dialog.proceedButton));

    // Confirming saves the edits the user had already typed into the section.
    await waitFor(() => expect(patientRecordSaveMock).toHaveBeenCalledOnce());
    await waitFor(() => expect(reminderDialog()).toBeNull());
    // The reminder is advisory only - it never persists an attestation the staff member didn't make.
    expect(updatePatientVisitDetailsMock).not.toHaveBeenCalled();
    expect(consentCheckbox()).not.toBeChecked();
  });

  it('abandons the save when the reminder is cancelled', async () => {
    await renderPage();

    await savePatientRecord();
    await screen.findByTestId(dataTestIds.visitDetailsPage.consentReminderDialog);

    await userEvent.click(screen.getByTestId(dataTestIds.dialog.cancelButton));

    await waitFor(() => expect(reminderDialog()).toBeNull());
    expect(patientRecordSaveMock).not.toHaveBeenCalled();
  });

  it('saves straight away once the attestation checkbox is checked, without waiting on its own Save', async () => {
    await renderPage();

    await userEvent.click(consentCheckbox());
    await savePatientRecord();

    // Checking the box is enough: the old flow needed the consent block's Save committed first.
    await waitFor(() => expect(patientRecordSaveMock).toHaveBeenCalledOnce());
    expect(reminderDialog()).toBeNull();
  });

  it('raises no reminder for a visit whose attestation is already persisted', async () => {
    await renderPage({ consentIsAttested: true });

    expect(consentCheckbox()).toBeChecked();
    await savePatientRecord();

    await waitFor(() => expect(patientRecordSaveMock).toHaveBeenCalledOnce());
    expect(reminderDialog()).toBeNull();
  });

  it('auto-selects the attestation when the patient signed consent in their paperwork', async () => {
    await renderPage({ consentIsAttested: false, patientSignedConsent: true });

    expect(consentCheckbox()).toBeChecked();
    // Signed consent means no reminder, even though no staff attestation is recorded yet.
    await savePatientRecord();
    await waitFor(() => expect(patientRecordSaveMock).toHaveBeenCalledOnce());
    expect(reminderDialog()).toBeNull();

    // The auto-selection still differs from what's persisted, so it can be committed.
    expect(consentSaveButton()).toBeEnabled();
    getPatientVisitDetailsMock.mockResolvedValue(visitDetails(true));
    await userEvent.click(consentSaveButton());
    await waitFor(() =>
      expect(updatePatientVisitDetailsMock).toHaveBeenCalledWith(expect.anything(), {
        appointmentId: 'appointment-1',
        bookingDetails: { consentForms: { consentAttested: true } },
      })
    );
  });

  // The consent-files query is independent of the visit query, so the account form can be editable
  // while the checkbox is still unseeded. A save landing in that window has to be judged on the
  // server's answer, not on the unseeded value reading as unattested.
  it('raises no reminder for an attested visit saved while the consent files are still loading', async () => {
    mountPage({ consentIsAttested: true, filesStillLoading: true });

    await savePatientRecord();

    await waitFor(() => expect(patientRecordSaveMock).toHaveBeenCalledOnce());
    expect(reminderDialog()).toBeNull();
    // Still unseeded: the footer only renders once the files query settles.
    expect(screen.queryByText('I verify that patient consent has been obtained.')).toBeNull();
  });

  it('still reminds for an unattested visit saved while the consent files are still loading', async () => {
    mountPage({ consentIsAttested: false, filesStillLoading: true });

    await savePatientRecord();

    await screen.findByTestId(dataTestIds.visitDetailsPage.consentReminderDialog);
    expect(patientRecordSaveMock).not.toHaveBeenCalled();
  });

  it('abandons a second save rather than stranding the one already awaiting the reminder', async () => {
    await renderPage();
    const confirmSave = confirmSaveRef.current;
    expect(confirmSave).toBeDefined();

    const secondSaveMock = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    let firstSettled = false;
    let secondSettled = false;

    // Two saves racing inside one tick - unreachable by clicking, since the dialog is modal, but
    // the guard must not overwrite the first save's resolver if it ever happens.
    await act(async () => {
      void confirmSave!(patientRecordSaveMock).then(() => {
        firstSettled = true;
      });
      void confirmSave!(secondSaveMock).then(() => {
        secondSettled = true;
      });
    });

    // The second is dropped straight away instead of taking over the dialog.
    expect(secondSettled).toBe(true);
    expect(secondSaveMock).not.toHaveBeenCalled();
    expect(firstSettled).toBe(false);

    // Only one dialog is up, and confirming it settles the save that opened it.
    await screen.findByTestId(dataTestIds.visitDetailsPage.consentReminderDialog);
    await userEvent.click(screen.getByTestId(dataTestIds.dialog.proceedButton));

    await waitFor(() => expect(firstSettled).toBe(true));
    expect(patientRecordSaveMock).toHaveBeenCalledOnce();
  });

  it('reopens the reminder for a later save once an earlier one has been cancelled', async () => {
    await renderPage();

    await savePatientRecord();
    await screen.findByTestId(dataTestIds.visitDetailsPage.consentReminderDialog);
    await userEvent.click(screen.getByTestId(dataTestIds.dialog.cancelButton));
    await waitFor(() => expect(reminderDialog()).toBeNull());

    // Cancelling has to clear the pending-save guard, or every later save would be dropped silently.
    await savePatientRecord();
    await screen.findByTestId(dataTestIds.visitDetailsPage.consentReminderDialog);
    await userEvent.click(screen.getByTestId(dataTestIds.dialog.proceedButton));
    await waitFor(() => expect(patientRecordSaveMock).toHaveBeenCalledOnce());
  });

  it('reopens the reminder for a later save once an earlier one has completed', async () => {
    await renderPage();

    await savePatientRecord();
    await userEvent.click(await screen.findByTestId(dataTestIds.dialog.proceedButton));
    await waitFor(() => expect(patientRecordSaveMock).toHaveBeenCalledOnce());
    await waitFor(() => expect(reminderDialog()).toBeNull());

    await savePatientRecord();
    await screen.findByTestId(dataTestIds.visitDetailsPage.consentReminderDialog);
    await userEvent.click(screen.getByTestId(dataTestIds.dialog.proceedButton));
    await waitFor(() => expect(patientRecordSaveMock).toHaveBeenCalledTimes(2));
  });

  it('persists the attestation from the consent block, and lets it be retracted', async () => {
    await renderPage();

    // Nothing changed yet, so the block's own save starts disabled.
    expect(consentSaveButton()).toBeDisabled();

    await userEvent.click(consentCheckbox());
    expect(consentSaveButton()).toBeEnabled();

    getPatientVisitDetailsMock.mockResolvedValue(visitDetails(true));
    await userEvent.click(consentSaveButton());

    await waitFor(() =>
      expect(updatePatientVisitDetailsMock).toHaveBeenCalledWith(expect.anything(), {
        appointmentId: 'appointment-1',
        bookingDetails: { consentForms: { consentAttested: true } },
      })
    );
    await waitFor(() => expect(consentSaveButton()).toBeDisabled());

    // Unchecking is a savable change: the retraction has to be persistable, otherwise the page and
    // the server would be stuck disagreeing.
    await userEvent.click(consentCheckbox());
    expect(consentSaveButton()).toBeEnabled();
    getPatientVisitDetailsMock.mockResolvedValue(visitDetails(false));
    await userEvent.click(consentSaveButton());

    await waitFor(() =>
      expect(updatePatientVisitDetailsMock).toHaveBeenCalledWith(expect.anything(), {
        appointmentId: 'appointment-1',
        bookingDetails: { consentForms: { consentAttested: false } },
      })
    );
    // Back to unattested, so the reminder comes back.
    await savePatientRecord();
    await screen.findByTestId(dataTestIds.visitDetailsPage.consentReminderDialog);
  });
});
