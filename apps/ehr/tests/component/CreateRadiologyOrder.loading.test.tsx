import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateRadiologyOrder } from '../../src/features/radiology/pages/CreateRadiologyOrder';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: 'appointment-1' }),
  };
});

vi.mock('../../src/features/visits/shared/components/QuickPicksButton', () => ({
  QuickPicksButton: ({ loading }: { loading?: boolean }) => (
    <div data-testid="quick-picks-button">{String(Boolean(loading))}</div>
  ),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: {}, oystehr: {} }),
}));

vi.mock('../../src/hooks/useEvolveUser', () => ({
  default: () => ({ hasRole: () => false }),
}));

vi.mock('../../src/hooks/useMergedQuickPicks', () => ({
  sortQuickPicks: (a: any, b: any) => (a.name ?? '').localeCompare(b.name ?? ''),
  useMergedRadiologyQuickPicks: () => ({
    quickPicks: [],
    loading: true,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ encounter: { id: 'encounter-1' } }),
  useChartData: () => ({ chartData: {}, setPartialChartData: vi.fn() }),
  useSaveChartData: () => ({ mutate: vi.fn() }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useGetCPTHCPCSSearch: () => ({ isFetching: false, data: { codes: [] } }),
  useICD10SearchNew: () => ({ isFetching: false, data: { codes: [] } }),
}));

vi.mock('../../src/hooks/useCommandPaletteSource', () => ({
  useCommandPaletteSource: vi.fn(),
}));

vi.mock('../../src/hooks/usePendingQuickPick', () => ({
  usePendingQuickPick: vi.fn(),
}));

vi.mock('../../src/shared/hooks/useDebounce', () => ({
  useDebounce: () => ({
    debounce: (callback: () => void) => callback(),
  }),
}));

vi.mock('../../src/features/common/DetailPageContainer', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../src/features/radiology/components/RadiologyBreadcrumbs', () => ({
  WithRadiologyBreadcrumbs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../src/features/radiology/components/useRadiologyConsentExists', () => ({
  useRadiologyConsentExists: () => false,
}));

describe('CreateRadiologyOrder', () => {
  it('passes the loading state to quick picks', () => {
    render(<CreateRadiologyOrder />);

    expect(screen.getByTestId('quick-picks-button')).toHaveTextContent('true');
  });
});
