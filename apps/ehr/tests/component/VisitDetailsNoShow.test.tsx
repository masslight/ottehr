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

const { getPatientVisitDetailsMock, changeVisitStatusMock } = vi.hoisted(() => ({
  getPatientVisitDetailsMock: vi.fn(),
  changeVisitStatusMock: vi.fn(),
}));

vi.mock('src/api/api', () => ({
  getPatientVisitDetails: (...args: unknown[]) => getPatientVisitDetailsMock(...args),
  updatePatientVisitDetails: vi.fn().mockResolvedValue(undefined),
  getVisitFaxHistory: vi.fn().mockResolvedValue({ faxesSent: [] }),
  listServiceCategories: vi.fn().mockResolvedValue({ serviceCategories: [] }),
  generatePaperworkPdf: vi.fn(),
  getOrCreateVisitDetailsPdf: vi.fn(),
}));

vi.mock('src/helpers/inPersonVisitStatusUtils', () => ({
  handleChangeInPersonVisitStatus: (...args: unknown[]) => changeVisitStatusMock(...args),
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

vi.mock('src/pages/PatientInformationPage', () => ({ PatientAccountComponent: () => <div /> }));
vi.mock('src/layout/PageContainer', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('src/components/CardThumbnail', () => ({ default: () => <div /> }));
vi.mock('src/features/visits/shared/components/patient/Header', () => ({ Header: () => <div /> }));
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
const ENCOUNTER_ID = 'encounter-1';

const visitDetails = (appointmentStatus: string, encounterStatus: string): EHRVisitDetails =>
  ({
    appointment: {
      resourceType: 'Appointment',
      id: APPOINTMENT_ID,
      status: appointmentStatus,
      start: '2026-08-19T15:00:00.000Z',
      appointmentType: { text: 'pre-booked' },
      participant: [],
    },
    patient: { resourceType: 'Patient', id: 'patient-1', name: [{ given: ['Test'], family: 'Patient' }] },
    encounter: { resourceType: 'Encounter', id: ENCOUNTER_ID, status: encounterStatus },
    flags: [],
    visitTimezone: 'America/New_York',
    qrId: 'qr-1',
    consentIsAttested: true,
    responsiblePartyName: null,
    responsiblePartyEmail: null,
    consentDetails: null,
  }) as unknown as EHRVisitDetails;

const renderPage = async (details: EHRVisitDetails): Promise<HTMLElement> => {
  getPatientVisitDetailsMock.mockResolvedValue(details);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <VisitDetailsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
  const statusChip = await screen.findByTestId(dataTestIds.dashboard.appointmentStatus);
  await userEvent.click(screen.getByTestId(dataTestIds.visitDetailsPage.actionsMenuButton));
  return statusChip;
};

describe('the no-show actions on a visit details page', () => {
  beforeEach(() => {
    getPatientVisitDetailsMock.mockReset();
    changeVisitStatusMock.mockReset().mockResolvedValue(undefined);
  });

  it('marks a pending visit as a no-show and reloads it', async () => {
    await renderPage(visitDetails('booked', 'planned'));

    expect(screen.queryByTestId(dataTestIds.visitDetailsPage.returnToArrivedMenuItem)).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId(dataTestIds.visitDetailsPage.noShowMenuItem));

    expect(changeVisitStatusMock).toHaveBeenCalledWith(
      { encounterId: ENCOUNTER_ID, updatedStatus: 'no show' },
      expect.anything()
    );
    await waitFor(() => expect(getPatientVisitDetailsMock).toHaveBeenCalledTimes(2));
  });

  it('shows a no-show visit as one and returns it to arrived', async () => {
    const statusChip = await renderPage(visitDetails('noshow', 'cancelled'));

    expect(statusChip).toHaveTextContent('no show');
    expect(screen.queryByTestId(dataTestIds.visitDetailsPage.noShowMenuItem)).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId(dataTestIds.visitDetailsPage.returnToArrivedMenuItem));

    expect(changeVisitStatusMock).toHaveBeenCalledWith(
      { encounterId: ENCOUNTER_ID, updatedStatus: 'arrived' },
      expect.anything()
    );
  });

  it('offers neither once the patient has arrived', async () => {
    await renderPage(visitDetails('arrived', 'arrived'));

    expect(screen.queryByTestId(dataTestIds.visitDetailsPage.noShowMenuItem)).not.toBeInTheDocument();
    expect(screen.queryByTestId(dataTestIds.visitDetailsPage.returnToArrivedMenuItem)).not.toBeInTheDocument();
  });
});
