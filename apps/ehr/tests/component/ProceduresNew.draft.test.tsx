// vi.mock calls must come before any component imports (Vitest hoists them).

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: 'appt-1' }),
  };
});

vi.mock('notistack', () => ({
  enqueueSnackbar: vi.fn(),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: {} }),
}));

vi.mock('../../src/hooks/useEvolveUser', () => ({
  default: () => ({ hasRole: () => false }),
}));

vi.mock('../../src/hooks/useCommandPaletteSource', () => ({
  useCommandPaletteSource: vi.fn(),
}));

vi.mock('../../src/hooks/usePendingQuickPick', () => ({
  usePendingQuickPick: vi.fn(),
}));

vi.mock('../../src/hooks/useMergedQuickPicks', () => ({
  sortQuickPicks: vi.fn(),
  useMergedProcedureQuickPicks: () => ({ quickPicks: [], loading: false, refetch: vi.fn() }),
}));

vi.mock('../../src/shared/hooks/useDebounce', () => ({
  useDebounce: () => ({ debounce: (cb: () => void) => cb() }),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ encounter: { id: 'enc-procedure-test' } }),
  useChartData: () => ({ chartData: {}, setPartialChartData: vi.fn() }),
  useSaveChartData: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
  useDeleteChartData: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useGetCPTHCPCSSearch: () => ({ isFetching: false, data: { codes: [] } }),
  useRecommendBillingCodes: () => ({ mutateAsync: vi.fn() }),
  useAiSuggestionNotes: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('../../src/components/AccordionCard', () => ({
  AccordionCard: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../src/components/ActionsList', () => ({
  ActionsList: () => <div />,
}));

vi.mock('../../src/components/DeleteIconButton', () => ({
  DeleteIconButton: () => <div />,
}));

vi.mock('../../src/components/RoundedButton', () => ({
  RoundedButton: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));

vi.mock('../../src/components/input/AutocompleteInput', () => ({
  AutocompleteInput: () => <div />,
}));

vi.mock('../../src/components/WithTooltip', () => ({
  TooltipWrapper: ({ children }: any) => <div>{children}</div>,
  CPT_TOOLTIP_PROPS: {},
}));

vi.mock('../../src/features/visits/shared/components/PageTitle', () => ({
  PageTitle: () => <div />,
}));

vi.mock('../../src/features/visits/shared/components/QuickPicksButton', () => ({
  QuickPicksButton: () => <div />,
}));

vi.mock('../../src/features/visits/shared/components/assessment-tab/DiagnosesField', () => ({
  DiagnosesField: () => <div />,
}));

vi.mock('../../src/features/visits/in-person/components/InfoAlert', () => ({
  InfoAlert: () => <div />,
}));

vi.mock('../../src/features/visits/shared/components/AiSection', () => ({
  AiSectionContainer: () => <div />,
}));

vi.mock('../../src/api/api', () => ({
  createProcedureQuickPick: vi.fn(),
  getProcedureQuickPicks: vi.fn().mockResolvedValue({ quickPicks: [] }),
  updateProcedureQuickPick: vi.fn(),
}));

// Component and store imports come after all vi.mock calls.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProceduresNew from '../../src/features/visits/in-person/pages/ProceduresNew';
import { useProcedureStore } from '../../src/state/draft-data.store';

const ENCOUNTER_ID = 'enc-procedure-test';

const createWrapper = (): ((props: { children: ReactNode }) => JSX.Element) => {
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

const renderComponent = (): ReturnType<typeof render> => render(<ProceduresNew />, { wrapper: createWrapper() });

describe('ProceduresNew — draft store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProcedureStore.getState().clearDraft(ENCOUNTER_ID);
    // Stub fetch so the PDF-check useEffect does not trigger the no-network guard.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, headers: { get: () => '' } }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // --- Banner (UnsavedDraftWarning) tests ---

  it('shows the draft banner when a draft exists for the encounter', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, { procedureDetails: 'Detailed description here' });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('does not show the draft banner when no draft exists', async () => {
    renderComponent();
    // Give effects time to settle before asserting absence.
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('banner shows the "in progress" message when a draft exists', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, { procedureDetails: 'Detailed description here' });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText(/you have a procedure in progress/i)).toBeInTheDocument();
    });
  });

  // --- Clear Form button tests ---

  it('renders the Clear Form button when there is no procedureId', () => {
    renderComponent();
    expect(screen.getByRole('button', { name: /clear form/i })).toBeInTheDocument();
  });

  it('Clear Form button displays the text "Clear Form"', () => {
    renderComponent();
    const btn = screen.getByRole('button', { name: /clear form/i });
    expect(btn).toHaveTextContent('Clear Form');
  });

  // --- Form population from draft ---

  it('populates the Procedure details field with the value from the draft', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, { procedureDetails: 'Detailed description here' });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /procedure details/i })).toHaveValue('Detailed description here');
    });
  });

  // --- Clear Form clears the draft store ---

  it('clicking Clear Form removes the draft from the store', async () => {
    const user = userEvent.setup();
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, { procedureDetails: 'Detailed description here' });
    renderComponent();
    await user.click(screen.getByRole('button', { name: /clear form/i }));
    expect(useProcedureStore.getState().hasDraft(ENCOUNTER_ID)).toBe(false);
  });

  // --- Clear Form resets the procedureDetails field ---

  it('clicking Clear Form resets the Procedure details field to empty', async () => {
    const user = userEvent.setup();
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, { procedureDetails: 'Detailed description here' });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /procedure details/i })).toHaveValue('Detailed description here');
    });
    await user.click(screen.getByRole('button', { name: /clear form/i }));
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /procedure details/i })).toHaveValue('');
    });
  });
});
