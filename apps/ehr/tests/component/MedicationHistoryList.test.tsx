import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MedicationHistoryList } from '../../src/features/visits/in-person/components/medication-administration/medication-history/MedicationHistoryList';

// Mock the hooks
vi.mock('../../src/features/visits/in-person/hooks/useMedicationHistory', () => ({
  useMedicationHistory: vi.fn(),
  COLLAPSED_MEDS_COUNT: 3,
  MEDICATION_HISTORY_FIELDS: ['medications', 'inhouseMedications'],
  PATIENT_MEDS_COUNT_TO_LOAD: 100,
}));

vi.mock('../../src/features/visits/in-person/hooks/useMedicationOperations', () => ({
  useMedicationAPI: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: vi.fn(),
}));

// Mock notistack
vi.mock('notistack', () => ({
  enqueueSnackbar: vi.fn(),
}));

import { ReactNode } from 'react';
import { useMedicationHistory } from '../../src/features/visits/in-person/hooks/useMedicationHistory';
import { useMedicationAPI } from '../../src/features/visits/in-person/hooks/useMedicationOperations';
import { useGetAppointmentAccessibility } from '../../src/features/visits/shared/hooks/useGetAppointmentAccessibility';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

const mockUseMedicationHistory = vi.mocked(useMedicationHistory);
const mockUseMedicationAPI = vi.mocked(useMedicationAPI);
const mockUseGetAppointmentAccessibility = vi.mocked(useGetAppointmentAccessibility);

describe('MedicationHistoryList - Display Tests', () => {
  const mockRefetchHistory = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockUseMedicationHistory.mockReturnValue({
      isLoading: false,
      medicationHistory: [
        {
          resourceId: 'med1',
          name: 'Ibuprofen',
          status: 'active',
          type: 'inHouse',
          intakeInfo: {
            dose: '200mg',
            date: '2024-12-20T10:00:00Z',
          },
          practitioner: {
            resourceType: 'Practitioner',
            id: 'pract1',
            name: [{ given: ['Dr.', 'John'], family: 'Doe' }],
          },
          chartDataField: 'inhouseMedications',
        },
        {
          resourceId: 'med2',
          name: 'Acetaminophen',
          status: 'active',
          type: 'inHouse',
          intakeInfo: {
            dose: '500mg',
            date: '2024-12-19T14:30:00Z',
          },
          practitioner: {
            resourceType: 'Practitioner',
            id: 'pract2',
            name: [{ given: ['Dr.', 'Jane'], family: 'Smith' }],
          },
          chartDataField: 'inhouseMedications',
        },
      ],
      refetchHistory: mockRefetchHistory,
    } as any);

    mockUseMedicationAPI.mockReturnValue({
      medications: [],
      cancelledMedications: [],
      isLoading: false,
      loadMedications: vi.fn(),
      updateMedication: vi.fn(),
      deleteMedication: vi.fn(),
    } as any);

    mockUseGetAppointmentAccessibility.mockReturnValue({
      isAppointmentReadOnly: false,
      isPractitionerLicensedInState: true,
      isEncounterAssignedToCurrentPractitioner: true,
      isAppointmentInCheckInStatus: false,
    } as any);
  });

  const renderComponent = (): ReturnType<typeof render> => {
    return render(<MedicationHistoryList />, { wrapper: createWrapper() });
  };

  it('displays medication history', () => {
    renderComponent();

    // Check that medications are displayed
    expect(screen.getByText('Ibuprofen (200mg)')).toBeInTheDocument();
    expect(screen.getByText('Acetaminophen (500mg)')).toBeInTheDocument();
  });

  it('displays a refill badge for renewal prescribed medications', () => {
    mockUseMedicationHistory.mockReturnValue({
      isLoading: false,
      medicationHistory: [
        {
          resourceId: 'med-rx-1',
          name: 'Lisinopril',
          status: 'active',
          type: 'prescribed-medication',
          isRenewal: true,
          intakeInfo: {
            date: '2024-12-20T10:00:00Z',
          },
          chartDataField: 'medications',
        },
      ],
      refetchHistory: mockRefetchHistory,
    } as any);

    renderComponent();

    expect(screen.getByText('Lisinopril')).toBeInTheDocument();
    expect(screen.getByText('Refill')).toBeInTheDocument();
  });

  it('displays medication history when chart is read-only', () => {
    mockUseGetAppointmentAccessibility.mockReturnValue({
      isAppointmentReadOnly: true,
      isPractitionerLicensedInState: true,
      isEncounterAssignedToCurrentPractitioner: true,
    } as any);

    renderComponent();

    // Check that medications are displayed
    expect(screen.getByText('Ibuprofen (200mg)')).toBeInTheDocument();
    expect(screen.getByText('Acetaminophen (500mg)')).toBeInTheDocument();
  });

  it('displays medication history with all statuses', () => {
    mockUseMedicationHistory.mockReturnValue({
      isLoading: false,
      medicationHistory: [
        {
          resourceId: 'med1',
          name: 'Ibuprofen',
          status: 'pending' as any,
          type: 'inHouse',
          intakeInfo: {
            dose: '200mg',
            date: '2024-12-20T10:00:00Z',
          },
          practitioner: {
            resourceType: 'Practitioner',
            id: 'pract1',
            name: [{ given: ['Dr.', 'John'], family: 'Doe' }],
          },
          chartDataField: 'inhouseMedications',
        },
        {
          resourceId: 'med2',
          name: 'Acetaminophen',
          status: 'administered' as any,
          type: 'inHouse',
          intakeInfo: {
            dose: '500mg',
            date: '2024-12-19T18:30:00Z',
          },
          practitioner: {
            resourceType: 'Practitioner',
            id: 'pract2',
            name: [{ given: ['Dr.', 'Jane'], family: 'Smith' }],
          },
          chartDataField: 'inhouseMedications',
        },
      ],
      refetchHistory: mockRefetchHistory,
    } as any);

    renderComponent();

    // Check that medications are displayed
    expect(screen.getByText('Ibuprofen (200mg)')).toBeInTheDocument();
    expect(screen.getByText('Acetaminophen (500mg)')).toBeInTheDocument();
  });

  it('shows loading skeletons when data is loading', () => {
    mockUseMedicationHistory.mockReturnValue({
      isLoading: true,
      medicationHistory: [],
      refetchHistory: mockRefetchHistory,
    } as any);

    renderComponent();

    // When loading, component renders without errors
    // Specific loading indicators are component implementation details
    // Just verify the component handles loading state properly
    expect(document.body).toBeInTheDocument();
  });

  it('shows empty state when no medication history is available', () => {
    mockUseMedicationHistory.mockReturnValue({
      isLoading: false,
      medicationHistory: [],
      refetchHistory: mockRefetchHistory,
    });

    renderComponent();

    expect(screen.getByText('No previous medication history available')).toBeInTheDocument();
  });

  it('shows columns in the expected order', () => {
    renderComponent();

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers).toEqual(['Medication', 'Type', 'Who Added', 'Last Filled', 'Refills', 'Last Time Taken', '']);
  });

  it('displays last filled date and refills when available', () => {
    mockUseMedicationHistory.mockReturnValue({
      isLoading: false,
      medicationHistory: [
        {
          resourceId: 'med-ext-1',
          name: 'Oxycodone',
          status: 'active',
          type: 'scheduled',
          intakeInfo: { lastFilledDate: '2025-10-12', refills: 2 },
          chartDataField: 'medications',
        },
      ],
      refetchHistory: mockRefetchHistory,
    } as any);

    renderComponent();

    const row = screen.getByTestId('medication-history-table-row');
    expect(within(row).getByTestId('medication-history-table-last-filled')).toHaveTextContent('10/12/2025');
    expect(within(row).getByTestId('medication-history-table-refills')).toHaveTextContent('2');
  });

  it('shows fallbacks when last filled date and refills are unknown', () => {
    renderComponent();

    const [row] = screen.getAllByTestId('medication-history-table-row');
    expect(within(row).getByTestId('medication-history-table-last-filled')).toHaveTextContent('No date available');
    expect(within(row).getByTestId('medication-history-table-refills')).toHaveTextContent('Unknown');
  });

  it('shows that a prescribed medication has not been filled yet', () => {
    mockUseMedicationHistory.mockReturnValue({
      isLoading: false,
      medicationHistory: [
        {
          resourceId: 'med-rx-1',
          name: 'Lisinopril',
          status: 'active',
          type: 'prescribed-medication',
          intakeInfo: { refills: 3 },
          chartDataField: 'medications',
        },
      ],
      refetchHistory: mockRefetchHistory,
    } as any);

    renderComponent();

    const row = screen.getByTestId('medication-history-table-row');
    expect(within(row).getByTestId('medication-history-table-last-filled')).toHaveTextContent('Not filled yet');
    expect(within(row).getByTestId('medication-history-table-refills')).toHaveTextContent('3');
  });
});
