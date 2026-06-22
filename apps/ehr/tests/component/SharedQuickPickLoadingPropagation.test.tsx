import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KnownAllergiesProviderColumn } from '../../src/features/visits/shared/components/known-allergies/KnownAllergiesProviderColumn';
import { CurrentMedicationsProviderColumn } from '../../src/features/visits/shared/components/medical-history-tab/CurrentMedications/CurrentMedicationsProviderColumn';
import { MedicalConditionsProviderColumn } from '../../src/features/visits/shared/components/medical-history-tab/MedicalConditions/MedicalConditionsProviderColumn';

const allergyQuickPicksLoading = true;
const medicationQuickPicksLoading = true;
const conditionQuickPicksLoading = true;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'appointment-1' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('../../src/features/visits/shared/components/QuickPicksButton', () => ({
  QuickPicksButton: ({ loading }: { loading?: boolean }) => (
    <div data-testid="quick-picks-button">{String(Boolean(loading))}</div>
  ),
}));

vi.mock('../../src/hooks/useMergedQuickPicks', () => ({
  useMergedAllergyQuickPicks: () => ({ quickPicks: [], loading: allergyQuickPicksLoading, refetch: vi.fn() }),
  useMergedMedicationHistoryQuickPicks: () => ({
    quickPicks: [],
    loading: medicationQuickPicksLoading,
    refetch: vi.fn(),
  }),
  useMergedMedicalConditionQuickPicks: () => ({
    quickPicks: [],
    loading: conditionQuickPicksLoading,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));

vi.mock('../../src/features/visits/shared/hooks/useChartDataArrayValue', () => ({
  useChartDataArrayValue: () => ({
    isLoading: false,
    onSubmit: vi.fn(),
    values: [],
  }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useChartData: () => ({
    chartData: {},
    isLoading: false,
    setPartialChartData: vi.fn(),
    chartDataSetState: vi.fn(),
  }),
  useSaveChartData: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteChartData: () => ({ mutate: vi.fn(), isPending: false }),
  useAppointmentData: () => ({ appointment: {}, encounter: { id: 'encounter-1' } }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useGetAllergiesSearch: () => ({ isFetching: false, data: [] }),
  useGetMedicationsSearch: () => ({ isFetching: false, data: [] }),
  useICD10SearchNew: () => ({ isFetching: false, data: { codes: [] } }),
}));

vi.mock('../../src/hooks/useCommandPaletteSource', () => ({
  useCommandPaletteSource: vi.fn(),
}));

vi.mock('../../src/hooks/usePendingQuickPick', () => ({
  usePendingQuickPick: vi.fn(),
}));

describe('shared quick pick loading propagation', () => {
  it('passes the loading state to allergy quick picks', () => {
    render(<KnownAllergiesProviderColumn />);

    expect(screen.getByTestId('quick-picks-button')).toHaveTextContent('true');
  });

  it('passes the loading state to current medication quick picks', () => {
    render(
      <CurrentMedicationsProviderColumn
        medicationData={{ medications: [], isLoading: false, onRemove: vi.fn() }}
        onAddMedication={vi.fn(async () => true)}
      />
    );

    expect(screen.getByTestId('quick-picks-button')).toHaveTextContent('true');
  });

  it('passes the loading state to medical condition quick picks', () => {
    render(<MedicalConditionsProviderColumn />);

    expect(screen.getByTestId('quick-picks-button')).toHaveTextContent('true');
  });
});
