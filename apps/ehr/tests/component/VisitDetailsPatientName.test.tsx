import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { EHRVisitDetails } from 'utils/lib/types/data/visit-details.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn(), useParams: () => ({ id: APPOINTMENT_ID }) };
});

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehr: { fhir: { get: vi.fn(), search: vi.fn().mockResolvedValue({ unbundle: () => [] }) } },
    oystehrZambda: {},
  }),
}));

vi.mock('notistack', async () => {
  const actual = await vi.importActual<typeof import('notistack')>('notistack');
  return { ...actual, enqueueSnackbar: vi.fn() };
});

const { getPatientVisitDetailsMock, getVisitFaxHistoryMock, getAppointmentAndPatientHistoryMock } = vi.hoisted(() => ({
  getPatientVisitDetailsMock: vi.fn(),
  getVisitFaxHistoryMock: vi.fn(),
  getAppointmentAndPatientHistoryMock: vi.fn(),
}));

vi.mock('src/api/api', () => ({
  getPatientVisitDetails: (...args: unknown[]) => getPatientVisitDetailsMock(...args),
  updatePatientVisitDetails: vi.fn().mockResolvedValue(undefined),
  getVisitFaxHistory: (...args: unknown[]) => getVisitFaxHistoryMock(...args),
  listServiceCategories: vi.fn().mockResolvedValue({ serviceCategories: [] }),
  generatePaperworkPdf: vi.fn(),
  getOrCreateVisitDetailsPdf: vi.fn(),
}));

vi.mock('src/hooks/useVisitCards', () => ({
  useVisitCards: () => ({
    imagesLoading: false,
    refetchFileData: vi.fn(),
    consentPdfUrls: [],
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

// Balances come from a slow third-party call; the name must not wait on it.
vi.mock('src/hooks/useGetPatientBalances', () => ({
  useGetPatientBalances: () => ({ data: undefined, isLoading: true, refetch: vi.fn() }),
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
  return {
    ...actual,
    getAppointmentAndPatientHistory: (...args: unknown[]) => getAppointmentAndPatientHistoryMock(...args),
  };
});

vi.mock('src/pages/PatientInformationPage', () => ({ PatientAccountComponent: () => <div /> }));
vi.mock('src/layout/PageContainer', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('src/components/CardThumbnail', () => ({ default: () => <div /> }));
vi.mock('src/components/PatientPaymentsList', () => ({ default: () => <div /> }));
vi.mock('src/components/AppointmentNotesHistory', () => ({ default: () => <div /> }));
vi.mock('src/components/dialogs/ActivityLogDialog', () => ({ default: () => <div /> }));
vi.mock('src/components/ScannerModal', () => ({ ScannerModal: () => <div /> }));
vi.mock('src/features/visits/shared/components/patient/docs/PatientDocumentsExplorer', () => ({
  PatientDocumentsExplorer: () => <div />,
}));

import { dataTestIds } from '../../src/constants/data-test-ids';
import VisitDetailsPage from '../../src/pages/VisitDetailsPage';

// ============================================================================
// HARNESS
// ============================================================================

const APPOINTMENT_ID = 'appointment-1';

const visitDetails = {
  appointment: {
    resourceType: 'Appointment',
    id: APPOINTMENT_ID,
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
  consentIsAttested: true,
  responsiblePartyName: null,
  responsiblePartyEmail: null,
  consentDetails: null,
} as unknown as EHRVisitDetails;

const renderPage = (): void => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <VisitDetailsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const never = (): Promise<never> => new Promise(() => undefined);

describe("the patient's name on a visit details page", () => {
  beforeEach(() => {
    getPatientVisitDetailsMock.mockReset().mockResolvedValue(visitDetails);
    getVisitFaxHistoryMock.mockReset().mockResolvedValue({ faxesSent: [] });
    getAppointmentAndPatientHistoryMock.mockReset().mockResolvedValue(undefined);
  });

  it('renders as soon as the visit details load, while fax history and activity logs are still pending', async () => {
    getVisitFaxHistoryMock.mockImplementation(never);
    getAppointmentAndPatientHistoryMock.mockImplementation(never);

    renderPage();

    expect(await screen.findByTestId(dataTestIds.appointmentPage.patientFullName)).toHaveTextContent('Patient, Test');
  });

  it('renders while the activity log history is still pending after fax history loads', async () => {
    getAppointmentAndPatientHistoryMock.mockImplementation(never);

    renderPage();

    expect(await screen.findByTestId(dataTestIds.appointmentPage.patientFullName)).toHaveTextContent('Patient, Test');
  });

  it('renders once everything has loaded', async () => {
    renderPage();

    expect(await screen.findByTestId(dataTestIds.appointmentPage.patientFullName)).toHaveTextContent('Patient, Test');
  });
});
