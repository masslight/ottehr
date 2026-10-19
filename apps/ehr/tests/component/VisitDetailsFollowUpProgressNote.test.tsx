import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { buildFollowupEncounterType } from 'utils/lib/fhir/encounter';
import { EHRVisitDetails } from 'utils/lib/types/data/visit-details.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock, useParams: () => ({ id: FOLLOW_UP_APPOINTMENT_ID }) };
});

// Unlike the other VisitDetailsPage tests, this one needs a live fhir client: resolving a follow-up's
// origin appointment goes through it.
const { fhirGetMock, fhirSearchMock } = vi.hoisted(() => ({
  fhirGetMock: vi.fn(),
  fhirSearchMock: vi.fn(),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehr: { fhir: { get: fhirGetMock, search: fhirSearchMock } },
    oystehrZambda: {},
  }),
}));

vi.mock('notistack', async () => {
  const actual = await vi.importActual<typeof import('notistack')>('notistack');
  return { ...actual, enqueueSnackbar: vi.fn() };
});

const { getPatientVisitDetailsMock } = vi.hoisted(() => ({ getPatientVisitDetailsMock: vi.fn() }));

vi.mock('src/api/api', () => ({
  getPatientVisitDetails: (...args: unknown[]) => getPatientVisitDetailsMock(...args),
  updatePatientVisitDetails: vi.fn().mockResolvedValue(undefined),
  getVisitFaxHistory: vi.fn().mockResolvedValue({ faxesSent: [] }),
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

// A scheduled follow-up owns an Appointment of its own, which is the one this page is opened on.
const FOLLOW_UP_APPOINTMENT_ID = 'followup-appointment-1';
const FOLLOW_UP_ENCOUNTER_ID = 'followup-encounter-1';
// Its chart, though, lives under the origin visit.
const ORIGIN_APPOINTMENT_ID = 'origin-appointment-1';
const ORIGIN_ENCOUNTER_ID = 'origin-encounter-1';

const visitDetails = (isFollowUp: boolean): EHRVisitDetails =>
  ({
    appointment: {
      resourceType: 'Appointment',
      id: FOLLOW_UP_APPOINTMENT_ID,
      status: 'arrived',
      start: '2026-08-19T15:00:00.000Z',
      appointmentType: { text: 'walk-in' },
      participant: [],
    },
    patient: { resourceType: 'Patient', id: 'patient-1', name: [{ given: ['Test'], family: 'Patient' }] },
    encounter: {
      resourceType: 'Encounter',
      id: FOLLOW_UP_ENCOUNTER_ID,
      status: 'in-progress',
      ...(isFollowUp && {
        partOf: { reference: `Encounter/${ORIGIN_ENCOUNTER_ID}` },
        type: buildFollowupEncounterType('scheduled'),
      }),
    },
    flags: [],
    visitTimezone: 'America/New_York',
    qrId: 'qr-1',
    consentIsAttested: true,
    responsiblePartyName: null,
    responsiblePartyEmail: null,
    consentDetails: null,
  }) as unknown as EHRVisitDetails;

const renderPage = async ({ isFollowUp }: { isFollowUp: boolean }): Promise<HTMLElement> => {
  getPatientVisitDetailsMock.mockResolvedValue(visitDetails(isFollowUp));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <VisitDetailsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return screen.findByTestId(dataTestIds.visitDetailsPage.progressNoteButton);
};

describe('the progress note link on a visit details page', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    fhirGetMock.mockReset();
    fhirSearchMock.mockReset();
    // The page counts a visit's own follow-ups; none of these fixtures have any.
    fhirSearchMock.mockResolvedValue({ unbundle: () => [] });
    fhirGetMock.mockResolvedValue({
      resourceType: 'Encounter',
      id: ORIGIN_ENCOUNTER_ID,
      appointment: [{ reference: `Appointment/${ORIGIN_APPOINTMENT_ID}` }],
    });
  });

  it('routes a scheduled follow-up to the origin visit, keeping the follow-up encounter selected', async () => {
    const button = await renderPage({ isFollowUp: true });

    // The origin appointment is resolved from the follow-up encounter's partOf reference.
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(fhirGetMock).toHaveBeenCalledWith({ resourceType: 'Encounter', id: ORIGIN_ENCOUNTER_ID });

    button.click();

    expect(navigateMock).toHaveBeenCalledWith(
      `/in-person/${ORIGIN_APPOINTMENT_ID}/review-and-sign?encounterId=${FOLLOW_UP_ENCOUNTER_ID}`
    );
  });

  it('holds the link disabled rather than pointing it at the follow-up while the origin is unresolved', async () => {
    let resolveParentEncounter: (encounter: unknown) => void = () => undefined;
    fhirGetMock.mockReturnValue(
      new Promise((resolve) => {
        resolveParentEncounter = resolve;
      })
    );

    const button = await renderPage({ isFollowUp: true });
    // Once the lookup is in flight the visit itself has loaded, so nothing else is holding the button.
    await waitFor(() => expect(fhirGetMock).toHaveBeenCalled());
    expect(button).toBeDisabled();

    button.click();
    expect(navigateMock).not.toHaveBeenCalled();

    resolveParentEncounter({
      resourceType: 'Encounter',
      id: ORIGIN_ENCOUNTER_ID,
      appointment: [{ reference: `Appointment/${ORIGIN_APPOINTMENT_ID}` }],
    });
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it('routes an ordinary visit to its own appointment without an encounter param', async () => {
    const button = await renderPage({ isFollowUp: false });
    await waitFor(() => expect(button).not.toBeDisabled());

    button.click();

    expect(navigateMock).toHaveBeenCalledWith(`/in-person/${FOLLOW_UP_APPOINTMENT_ID}/review-and-sign`);
    expect(fhirGetMock).not.toHaveBeenCalled();
  });
});
