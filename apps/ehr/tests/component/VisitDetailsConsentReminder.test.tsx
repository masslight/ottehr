import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
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
const { consentPdfUrlsMock } = vi.hoisted(() => ({ consentPdfUrlsMock: { current: [] as string[] } }));

vi.mock('src/hooks/useVisitCards', () => ({
  useVisitCards: () => ({
    imagesLoading: false,
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
const { patientRecordSaveMock } = vi.hoisted(() => ({
  patientRecordSaveMock: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

vi.mock('src/pages/PatientInformationPage', () => ({
  PatientAccountComponent: ({ confirmSave }: { confirmSave?: ConfirmSave }) => (
    <button
      data-testid="save-patient-record"
      onClick={() => void (confirmSave ? confirmSave(patientRecordSaveMock) : patientRecordSaveMock())}
    >
      Save All
    </button>
  ),
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
}

const renderPage = async ({
  consentIsAttested = false,
  patientSignedConsent = false,
}: RenderOptions = {}): Promise<void> => {
  consentPdfUrlsMock.current = patientSignedConsent ? ['https://example.com/consent.pdf'] : [];
  getPatientVisitDetailsMock.mockResolvedValue(visitDetails(consentIsAttested));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <VisitDetailsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
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
