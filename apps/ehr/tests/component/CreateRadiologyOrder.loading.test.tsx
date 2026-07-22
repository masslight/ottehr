import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { CreateRadiologyOrder } from '../../src/features/radiology/pages/CreateRadiologyOrder';
import { useCreateRadiologyOrderStore } from '../../src/state/draft-data.store';

describe('CreateRadiologyOrder', () => {
  it('passes the loading state to quick picks', () => {
    render(<CreateRadiologyOrder />);

    expect(screen.getByTestId('quick-picks-button')).toHaveTextContent('true');
  });

  describe('draft behavior', () => {
    const ENCOUNTER_ID = 'encounter-1';

    beforeEach(() => {
      vi.clearAllMocks();
      useCreateRadiologyOrderStore.setState({ draftsByEncounterId: {} });
    });

    it('does not show the banner when the draft store is empty', () => {
      render(<CreateRadiologyOrder />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows the banner with in-progress message when a draft exists', () => {
      useCreateRadiologyOrderStore.getState().setDraft(ENCOUNTER_ID, { studyName: 'CT Chest' });

      render(<CreateRadiologyOrder />);

      expect(screen.getByRole('alert')).toHaveTextContent('radiology order in progress');
    });

    it('shows the restored message when hasNavigatedAway is true', () => {
      useCreateRadiologyOrderStore.getState().setDraft(ENCOUNTER_ID, { studyName: 'CT Chest', hasNavigatedAway: true });

      render(<CreateRadiologyOrder />);

      expect(screen.getByRole('alert')).toHaveTextContent('previously entered data has been restored');
    });

    it('does not show a Clear Form button when no draft exists', () => {
      render(<CreateRadiologyOrder />);

      expect(screen.queryByRole('button', { name: /clear form/i })).not.toBeInTheDocument();
    });

    it('shows a Clear Form button when a draft exists', () => {
      useCreateRadiologyOrderStore.getState().setDraft(ENCOUNTER_ID, { studyName: 'CT Chest' });

      render(<CreateRadiologyOrder />);

      expect(screen.getByRole('button', { name: /clear form/i })).toBeInTheDocument();
    });

    it('populates the Study Name field from the draft on mount', () => {
      useCreateRadiologyOrderStore.getState().setDraft(ENCOUNTER_ID, { studyName: 'CT Chest' });

      render(<CreateRadiologyOrder />);

      expect(screen.getByRole('textbox', { name: /study name/i })).toHaveValue('CT Chest');
    });

    it('clicking Clear Form clears the draft store', () => {
      useCreateRadiologyOrderStore.getState().setDraft(ENCOUNTER_ID, { studyName: 'CT Chest' });

      render(<CreateRadiologyOrder />);
      fireEvent.click(screen.getByRole('button', { name: /clear form/i }));

      expect(useCreateRadiologyOrderStore.getState().hasDraft(ENCOUNTER_ID)).toBe(false);
    });

    it('clicking Clear Form resets the Study Name field to empty', () => {
      useCreateRadiologyOrderStore.getState().setDraft(ENCOUNTER_ID, { studyName: 'CT Chest' });

      render(<CreateRadiologyOrder />);
      expect(screen.getByRole('textbox', { name: /study name/i })).toHaveValue('CT Chest');

      fireEvent.click(screen.getByRole('button', { name: /clear form/i }));

      expect(screen.getByRole('textbox', { name: /study name/i })).toHaveValue('');
    });
  });
});
