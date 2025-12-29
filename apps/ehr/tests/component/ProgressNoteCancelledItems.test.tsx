import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ExtendedMedicationDataForResponse, GetChartDataResponse, ProcedureDTO } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressNoteDetails } from '../../src/features/visits/in-person/components/progress-note/ProgressNoteDetails';

// Mock all the hooks and dependencies
vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: vi.fn(),
  useChartData: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/hooks/useOystehrAPIClient', () => ({
  useOystehrAPIClient: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/stores/contexts/useAppFlags', () => ({
  useAppFlags: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/stores/tracking-board/tracking-board.queries', () => ({
  useSignAppointmentMutation: vi.fn(),
  useChangeTelemedAppointmentStatusMutation: vi.fn(),
}));

vi.mock('../../src/hooks/useEvolveUser', () => ({
  default: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

vi.mock('../../src/features/visits/shared/hooks/useChartFields', () => ({
  useChartFields: vi.fn(),
}));

vi.mock('../../src/features/visits/in-person/hooks/useMedicationOperations', () => ({
  useMedicationAPI: vi.fn(),
}));

vi.mock('../../src/features/visits/in-person/hooks/useImmunization', () => ({
  useGetImmunizationOrders: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/hooks/usePatientInstructionsVisibility', () => ({
  usePatientInstructionsVisibility: vi.fn(),
}));

// Mock components to avoid complex rendering
vi.mock('../../src/features/visits/shared/components/review-tab/components/AllergiesContainer', () => ({
  AllergiesContainer: ({ notes }: { notes: any[] }) => (
    <div data-testid="allergies-container">{notes?.length > 0 ? `Allergies: ${notes.length}` : 'No allergies'}</div>
  ),
}));

vi.mock('../../src/features/visits/shared/components/review-tab/components/MedicationsContainer', () => ({
  MedicationsContainer: ({ notes }: { notes: any[] }) => (
    <div data-testid="medications-container">
      {notes?.length > 0 ? `Medications: ${notes.length}` : 'No medications'}
    </div>
  ),
}));

vi.mock('../../src/features/visits/shared/components/review-tab/components/MedicalConditionsContainer', () => ({
  MedicalConditionsContainer: ({ notes }: { notes: any[] }) => (
    <div data-testid="medical-conditions-container">
      {notes?.length > 0 ? `Medical Conditions: ${notes.length}` : 'No medical conditions'}
    </div>
  ),
}));

vi.mock('../../src/features/visits/shared/components/review-tab/components/SurgicalHistoryContainer', () => ({
  SurgicalHistoryContainer: ({ notes }: { notes: any[] }) => (
    <div data-testid="surgical-history-container">
      {notes?.length > 0 ? `Surgical History: ${notes.length}` : 'No surgical history'}
    </div>
  ),
}));

vi.mock('../../src/features/visits/in-person/components/progress-note/HospitalizationContainer', () => ({
  HospitalizationContainer: ({ notes }: { notes: any[] }) => (
    <div data-testid="hospitalization-container">
      {notes?.length > 0 ? `Hospitalization: ${notes.length}` : 'No hospitalization'}
    </div>
  ),
}));

vi.mock('../../src/features/visits/in-person/components/progress-note/InHouseMedicationsContainer', () => ({
  InHouseMedicationsContainer: ({ medications, notes }: { medications: any[]; notes: any[] }) => (
    <div data-testid="inhouse-medications-container">
      {medications?.length > 0 ? `In-house Medications: ${medications.length}` : 'No in-house medications'}
      {notes?.length > 0 ? `, Notes: ${notes.length}` : ''}
    </div>
  ),
}));

vi.mock('../../src/features/visits/in-person/components/ImmunizationContainer', () => ({
  ImmunizationContainer: ({ orders }: { orders: any[] }) => (
    <div data-testid="immunization-container">
      {orders?.length > 0 ? `Immunizations: ${orders.length}` : 'No immunizations'}
    </div>
  ),
}));

vi.mock('../../src/features/visits/shared/components/review-tab/components/ProceduresContainer', () => ({
  ProceduresContainer: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/components/review-tab/components/PatientInstructionsContainer', () => ({
  PatientInstructionsContainer: vi.fn(),
}));

import { useNavigate } from 'react-router-dom';
import { useGetImmunizationOrders } from '../../src/features/visits/in-person/hooks/useImmunization';
import { useMedicationAPI } from '../../src/features/visits/in-person/hooks/useMedicationOperations';
import { PatientInstructionsContainer } from '../../src/features/visits/shared/components/review-tab/components/PatientInstructionsContainer';
import { ProceduresContainer } from '../../src/features/visits/shared/components/review-tab/components/ProceduresContainer';
import { useChartFields } from '../../src/features/visits/shared/hooks/useChartFields';
import { useOystehrAPIClient } from '../../src/features/visits/shared/hooks/useOystehrAPIClient';
import { usePatientInstructionsVisibility } from '../../src/features/visits/shared/hooks/usePatientInstructionsVisibility';
import {
  useAppointmentData,
  useChartData,
} from '../../src/features/visits/shared/stores/appointment/appointment.store';
import { useAppFlags } from '../../src/features/visits/shared/stores/contexts/useAppFlags';
import {
  useChangeTelemedAppointmentStatusMutation,
  useSignAppointmentMutation,
} from '../../src/features/visits/shared/stores/tracking-board/tracking-board.queries';
import useEvolveUser from '../../src/hooks/useEvolveUser';

const mockUseAppointmentData = vi.mocked(useAppointmentData);
const mockUseChartData = vi.mocked(useChartData);
const mockUseChartFields = vi.mocked(useChartFields);
const mockUseMedicationAPI = vi.mocked(useMedicationAPI);
const mockUseGetImmunizationOrders = vi.mocked(useGetImmunizationOrders);
const mockUseAppFlags = vi.mocked(useAppFlags);
const mockUseOystehrAPIClient = vi.mocked(useOystehrAPIClient);
const mockUsePatientInstructionsVisibility = vi.mocked(usePatientInstructionsVisibility);
const mockUseNavigate = vi.mocked(useNavigate);
const mockUseEvolveUser = vi.mocked(useEvolveUser);
const mockUseSignAppointmentMutation = vi.mocked(useSignAppointmentMutation);
const mockUseChangeTelemedAppointmentStatusMutation = vi.mocked(useChangeTelemedAppointmentStatusMutation);
const mockProceduresContainer = vi.mocked(ProceduresContainer);
const mockPatientInstructionsContainer = vi.mocked(PatientInstructionsContainer);

describe('ProgressNoteDetails - Deleted Items Backend Filtering Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks - ensure all required fields are present
    mockUseAppointmentData.mockReturnValue({
      appointment: { id: 'appt1' } as any,
      encounter: { id: 'enc1' } as any,
      appointmentSetState: vi.fn(),
    } as any);

    mockUseChartData.mockReturnValue({
      chartData: {},
      isChartDataLoading: false,
      refetch: vi.fn(),
    } as any);

    mockUseChartFields.mockReturnValue({
      data: {},
      isLoading: false,
    } as any);

    mockUseMedicationAPI.mockReturnValue({
      medications: [],
      isLoading: false,
      loadMedications: vi.fn(),
      updateMedication: vi.fn(),
      deleteMedication: vi.fn(),
    } as any);

    mockUseGetImmunizationOrders.mockReturnValue({
      data: { orders: [] },
      isLoading: false,
    } as any);

    mockUseAppFlags.mockReturnValue({
      isInPerson: true,
      isVideoCallEnabled: false,
    } as any);

    mockUseOystehrAPIClient.mockReturnValue({
      apiClient: {} as any,
    } as any);

    mockUsePatientInstructionsVisibility.mockReturnValue({
      visible: true,
      setVisible: vi.fn(),
    } as any);

    mockUseNavigate.mockReturnValue(vi.fn() as any);

    mockUseEvolveUser.mockReturnValue({
      isProvider: true,
      user: {} as any,
    } as any);

    mockUseSignAppointmentMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
    } as any);

    mockUseChangeTelemedAppointmentStatusMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
    } as any);

    // Mock containers to return null by default
    mockProceduresContainer.mockReturnValue(null);
    mockPatientInstructionsContainer.mockReturnValue(null);
  });

  const renderComponent = (): ReturnType<typeof render> => {
    return render(
      <BrowserRouter>
        <ProgressNoteDetails />
      </BrowserRouter>
    );
  };

  it('displays active in-house medications (backend already filtered deleted ones)', () => {
    // Backend returns only active medications (deleted ones are already filtered out)
    const medications: ExtendedMedicationDataForResponse[] = [
      {
        id: 'med1',
        status: 'administered',
        medicationName: 'Active Medication',
        providerCreatedTheOrder: 'Dr. Smith',
        providerCreatedTheOrderId: 'prov1',
        dateTimeCreated: '2024-12-20T10:00:00Z',
        patient: 'patient123',
        encounterId: 'encounter123',
        dose: 200,
        route: 'oral',
      },
      {
        id: 'med3',
        status: 'administered',
        medicationName: 'Another Active Medication',
        providerCreatedTheOrder: 'Dr. Jones',
        providerCreatedTheOrderId: 'prov2',
        dateTimeCreated: '2024-12-20T11:00:00Z',
        patient: 'patient123',
        encounterId: 'encounter123',
        dose: 500,
        route: 'oral',
      },
    ];

    mockUseMedicationAPI.mockReturnValue({
      medications,
      isLoading: false,
      loadMedications: vi.fn(),
      updateMedication: vi.fn(),
      deleteMedication: vi.fn(),
    });

    renderComponent();

    // Verify that active medications are displayed
    const inHouseMedicationsContainer = screen.getByTestId('inhouse-medications-container');
    expect(inHouseMedicationsContainer).toHaveTextContent('In-house Medications: 2');
  });

  it('does not show in-house medications section when backend returns empty array', () => {
    // Backend filtered out all deleted medications, returning empty array
    mockUseMedicationAPI.mockReturnValue({
      medications: [],
      isLoading: false,
      loadMedications: vi.fn(),
      updateMedication: vi.fn(),
      deleteMedication: vi.fn(),
    });

    renderComponent();

    // When medications array is empty AND no notes, component should not render at all
    const inHouseMedicationsContainer = screen.queryByTestId('inhouse-medications-container');
    expect(inHouseMedicationsContainer).not.toBeInTheDocument();
  });

  it('displays active procedures (backend already filtered deleted ones)', () => {
    // Backend returns only active/completed procedures (deleted ones are already filtered out)
    const procedures: ProcedureDTO[] = [
      {
        resourceId: 'proc1',
        procedureType: 'Active Procedure',
      },
      {
        resourceId: 'proc3',
        procedureType: 'Another Active Procedure',
      },
    ];

    const chartData: Partial<GetChartDataResponse> = {
      procedures,
      patientId: 'patient123',
    };

    mockUseChartData.mockReturnValue({
      chartData: chartData as GetChartDataResponse,
      isChartDataLoading: false,
      refetch: vi.fn(),
      isLoading: false,
      isFetching: false,
      isPending: false,
      error: null,
      queryKey: [],
      isFetched: true,
      setPartialChartData: vi.fn(),
      updateObservation: vi.fn(),
      chartDataSetState: vi.fn(),
      chartDataRefetch: vi.fn(),
      chartDataError: null,
    });

    mockProceduresContainer.mockReturnValue(<div data-testid="procedures-container">Procedures: 2</div>);

    renderComponent();

    // Verify that ProceduresContainer was called (this means procedures were displayed)
    // The mock implementation already renders a test div, so we just check it was called
    expect(mockProceduresContainer).toHaveBeenCalled();

    // The presence of procedures container in the DOM means procedures were passed
    expect(screen.getByTestId('procedures-container')).toBeInTheDocument();
  });

  it('does not show procedures section when backend returns empty array', () => {
    // Backend filtered out all deleted procedures, returning empty array
    const chartData: Partial<GetChartDataResponse> = {
      procedures: [],
      patientId: 'patient123',
    };

    mockUseChartData.mockReturnValue({
      chartData: chartData as GetChartDataResponse,
      isChartDataLoading: false,
      refetch: vi.fn(),
      isLoading: false,
      isFetching: false,
      isPending: false,
      error: null,
      queryKey: [],
      isFetched: true,
      setPartialChartData: vi.fn(),
      updateObservation: vi.fn(),
      chartDataSetState: vi.fn(),
      chartDataRefetch: vi.fn(),
      chartDataError: null,
    });

    renderComponent();

    // When procedures array is empty, ProceduresContainer should not be called at all
    // due to showProceduresContainer condition in ProgressNoteDetails
    expect(mockProceduresContainer).not.toHaveBeenCalled();
  });

  it('shows procedures section when there are active procedures', () => {
    const procedures: ProcedureDTO[] = [
      {
        resourceId: 'proc1',
        procedureType: 'Active Procedure',
      },
    ];

    const chartData: Partial<GetChartDataResponse> = {
      procedures,
      patientId: 'patient123',
    };

    mockUseChartData.mockReturnValue({
      chartData: chartData as GetChartDataResponse,
      isChartDataLoading: false,
      refetch: vi.fn(),
      isLoading: false,
      isFetching: false,
      isPending: false,
      error: null,
      queryKey: [],
      isFetched: true,
      setPartialChartData: vi.fn(),
      updateObservation: vi.fn(),
      chartDataSetState: vi.fn(),
      chartDataRefetch: vi.fn(),
      chartDataError: null,
    });

    mockProceduresContainer.mockReturnValue(<div data-testid="procedures-container">Procedures: 1</div>);

    renderComponent();

    expect(screen.getByTestId('procedures-container')).toBeInTheDocument();
  });

  it('handles empty procedures array correctly', () => {
    const chartData: Partial<GetChartDataResponse> = {
      procedures: [],
      patientId: 'patient123',
    };

    mockUseChartData.mockReturnValue({
      chartData: chartData as GetChartDataResponse,
      isChartDataLoading: false,
      refetch: vi.fn(),
      isLoading: false,
      isFetching: false,
      isPending: false,
      error: null,
      queryKey: [],
      isFetched: true,
      setPartialChartData: vi.fn(),
      updateObservation: vi.fn(),
      chartDataSetState: vi.fn(),
      chartDataRefetch: vi.fn(),
      chartDataError: null,
    });

    renderComponent();

    // When procedures array is empty, container should not render
    expect(mockProceduresContainer).not.toHaveBeenCalled();
  });

  it('handles undefined procedures correctly', () => {
    const chartData: Partial<GetChartDataResponse> = {
      patientId: 'patient123',
    };

    mockUseChartData.mockReturnValue({
      chartData: chartData as GetChartDataResponse,
      isChartDataLoading: false,
      refetch: vi.fn(),
      isLoading: false,
      isFetching: false,
      isPending: false,
      error: null,
      queryKey: [],
      isFetched: true,
      setPartialChartData: vi.fn(),
      updateObservation: vi.fn(),
      chartDataSetState: vi.fn(),
      chartDataRefetch: vi.fn(),
      chartDataError: null,
    });

    renderComponent();

    // When procedures is undefined, container should not render
    expect(mockProceduresContainer).not.toHaveBeenCalled();
  });
});
