import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock calls MUST come before component imports (Vitest hoists them)

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: 'appt-1' }),
    Link: ({ children }: any) => <a>{children}</a>,
  };
});

vi.mock('notistack', () => ({
  enqueueSnackbar: vi.fn(),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: {} }),
}));

vi.mock('src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ visitType: 'in-person', isAppointmentReadOnly: false }),
}));

vi.mock('src/features/visits/shared/hooks/useMainEncounterChartData', () => ({
  useMainEncounterChartData: () => ({ data: undefined }),
}));

vi.mock('src/features/visits/shared/hooks/useOystehrAPIClient', () => ({
  useOystehrAPIClient: () => ({}),
}));

vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({
    encounter: { id: 'enc-external-test' },
    patient: { id: 'pat-1' },
    location: { id: 'loc-1' },
    followUpOriginEncounter: undefined,
  }),
  useChartData: () => ({
    chartData: { diagnosis: [] },
    setPartialChartData: vi.fn(),
  }),
  useSaveChartData: () => ({
    mutate: vi.fn(),
  }),
}));

vi.mock('src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useGetCreateExternalLabResources: () => ({
    data: {
      orderingLocations: [{ id: 'loc-1', enabledLabs: [] }],
      orderingLocationIds: ['loc-1'],
      coverages: [],
      appointmentIsWorkersComp: false,
    },
    isFetching: false,
    isError: false,
    error: undefined,
  }),
  useICD10SearchNew: () => ({ isFetching: false, data: { codes: [] } }),
}));

vi.mock('src/shared/hooks/useDebounce', () => ({
  useDebounce: () => ({ debounce: (cb: () => void) => cb() }),
}));

vi.mock('src/features/common/DetailPageContainer', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../src/features/external-labs/components/create/ExternalSelectedTests', () => ({
  ExternalSelectedTests: () => <div />,
}));

vi.mock('../../src/features/external-labs/components/labs-orders/LabBreadcrumbs', () => ({
  LabBreadcrumbs: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../src/features/external-labs/components/labs-orders/LabOrderLoading', () => ({
  LabOrderLoading: () => <div />,
}));

vi.mock('../../src/features/external-labs/components/LabsAutocomplete', () => ({
  LabsAutocomplete: () => <div />,
}));

vi.mock('src/components/ActionsList', () => ({
  ActionsList: () => <div />,
}));

vi.mock('src/components/DeleteIconButton', () => ({
  DeleteIconButton: () => <div />,
}));

vi.mock('../../src/api/api', () => ({
  createExternalLabOrder: vi.fn(),
}));

// Component import AFTER all vi.mock calls
import { CreateExternalLabOrder } from '../../src/features/external-labs/pages/CreateExternalLabOrder';
import { useCreateExternalLabStore } from '../../src/state/draft-data.store';

const ENCOUNTER_ID = 'enc-external-test';

describe('CreateExternalLabOrder — draft store behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCreateExternalLabStore.setState({ draftsByEncounterId: {} });
  });

  describe('banner visibility', () => {
    it('does not show the draft banner when the draft store is empty', () => {
      render(<CreateExternalLabOrder />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows the in-progress banner when a draft exists without hasNavigatedAway', () => {
      useCreateExternalLabStore.getState().setDraft(ENCOUNTER_ID, { psc: true });

      render(<CreateExternalLabOrder />);

      expect(screen.getByRole('alert')).toHaveTextContent('lab order in progress');
    });

    it('shows the restored banner when hasNavigatedAway is true', () => {
      useCreateExternalLabStore.getState().setDraft(ENCOUNTER_ID, { psc: true, hasNavigatedAway: true });

      render(<CreateExternalLabOrder />);

      expect(screen.getByRole('alert')).toHaveTextContent('previously entered data has been restored');
    });
  });

  describe('Clear Form button visibility', () => {
    it('does not render the Clear Form button when no draft exists', () => {
      render(<CreateExternalLabOrder />);

      expect(screen.queryByRole('button', { name: /clear form/i })).not.toBeInTheDocument();
    });

    it('renders the Clear Form button when a draft exists', () => {
      useCreateExternalLabStore.getState().setDraft(ENCOUNTER_ID, { psc: true });

      render(<CreateExternalLabOrder />);

      expect(screen.getByRole('button', { name: /clear form/i })).toBeInTheDocument();
    });
  });

  describe('form population from draft', () => {
    it('initializes the PSC switch as checked when draft has psc: true', () => {
      useCreateExternalLabStore.getState().setDraft(ENCOUNTER_ID, { psc: true });

      render(<CreateExternalLabOrder />);

      expect(screen.getByRole('checkbox', { name: /psc hold/i })).toBeChecked();
    });
  });

  describe('Clear Form interaction', () => {
    it('clicking Clear Form clears the draft store', async () => {
      useCreateExternalLabStore.getState().setDraft(ENCOUNTER_ID, { psc: true });
      const user = userEvent.setup();

      render(<CreateExternalLabOrder />);
      await user.click(screen.getByRole('button', { name: /clear form/i }));

      expect(useCreateExternalLabStore.getState().hasDraft(ENCOUNTER_ID)).toBe(false);
    });

    it('clicking Clear Form resets the PSC switch to unchecked', async () => {
      useCreateExternalLabStore.getState().setDraft(ENCOUNTER_ID, { psc: true });
      const user = userEvent.setup();

      render(<CreateExternalLabOrder />);
      expect(screen.getByRole('checkbox', { name: /psc hold/i })).toBeChecked();

      await user.click(screen.getByRole('button', { name: /clear form/i }));

      expect(screen.getByRole('checkbox', { name: /psc hold/i })).not.toBeChecked();
    });
  });
});
