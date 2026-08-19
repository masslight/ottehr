import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { EHRVisitDetails } from 'utils/lib/types/data/visit-details.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('src/hooks/useVisitCards', () => ({
  useVisitCards: () => ({
    imagesLoading: false,
    refetchFileData: vi.fn(),
    // A signed consent PDF makes the "Completed consent forms" block render its attestation footer.
    consentPdfUrls: ['https://example.com/consent.pdf'],
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

// The bottom "Save All" bar lives inside the shared patient-account component. Stub it down to the
// one prop this page controls so the assertion is about the gate, not about the account form.
vi.mock('src/pages/PatientInformationPage', () => ({
  PatientAccountComponent: ({ submitBlockedReason }: { submitBlockedReason?: string }) => (
    <div data-testid="save-all-blocked-reason">{submitBlockedReason ?? ''}</div>
  ),
}));

vi.mock('src/layout/PageContainer', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));

// Child blocks that fetch or render their own heavy trees; irrelevant to the consent gate.
vi.mock('src/components/CardThumbnail', () => ({ default: () => <div /> }));
vi.mock('src/components/PatientPaymentsList', () => ({ default: () => <div /> }));
vi.mock('src/components/AppointmentNotesHistory', () => ({ default: () => <div /> }));
vi.mock('src/components/dialogs/ActivityLogDialog', () => ({ default: () => <div /> }));
vi.mock('src/components/ScannerModal', () => ({ ScannerModal: () => <div /> }));

import { dataTestIds } from '../../src/constants/data-test-ids';
import VisitDetailsPage from '../../src/pages/VisitDetailsPage';

// ============================================================================
// HARNESS
// ============================================================================

const CONSENT_REQUIRED_MESSAGE = 'Please check "I verify that patient consent has been obtained." before saving.';

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

const renderPage = async (consentIsAttested: boolean): Promise<void> => {
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

const consentCheckbox = (): HTMLInputElement =>
  screen.getByTestId(dataTestIds.visitDetailsPage.consentAttestationCheckbox).querySelector('input')!;

const consentSaveButton = (): HTMLElement =>
  screen.getByTestId(dataTestIds.visitDetailsPage.consentAttestationSaveButton);

const saveAllBlockedReason = (): string => screen.getByTestId('save-all-blocked-reason').textContent ?? '';

beforeEach(() => {
  vi.clearAllMocks();
  updatePatientVisitDetailsMock.mockResolvedValue(undefined);
});

// ============================================================================
// TESTS
// ============================================================================

describe('Visit details consent attestation gate', () => {
  it('blocks both saves until the attestation checkbox is checked', async () => {
    await renderPage(false);

    expect(consentCheckbox()).not.toBeChecked();
    expect(consentSaveButton()).toBeDisabled();
    expect(saveAllBlockedReason()).toBe(CONSENT_REQUIRED_MESSAGE);

    await userEvent.click(consentCheckbox());

    expect(consentSaveButton()).toBeEnabled();
    await waitFor(() => expect(saveAllBlockedReason()).toBe(''));
  });

  it('re-blocks both saves when an attested consent is unchecked', async () => {
    await renderPage(true);

    expect(consentCheckbox()).toBeChecked();
    expect(saveAllBlockedReason()).toBe('');
    // Nothing changed yet, so the block's own save stays disabled.
    expect(consentSaveButton()).toBeDisabled();

    await userEvent.click(consentCheckbox());

    // Unchecking is a change, but an unchecked attestation may never be saved.
    expect(consentSaveButton()).toBeDisabled();
    await waitFor(() => expect(saveAllBlockedReason()).toBe(CONSENT_REQUIRED_MESSAGE));
  });

  it('persists the attestation when the consent block is saved', async () => {
    await renderPage(false);

    await userEvent.click(consentCheckbox());
    await userEvent.click(consentSaveButton());

    await waitFor(() =>
      expect(updatePatientVisitDetailsMock).toHaveBeenCalledWith(expect.anything(), {
        appointmentId: 'appointment-1',
        bookingDetails: { consentForms: { consentAttested: true } },
      })
    );
  });
});
