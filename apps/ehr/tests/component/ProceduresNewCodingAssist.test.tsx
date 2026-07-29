// Component tests for the deterministic procedure-coding assist on ProceduresNew:
// Area 1 (deterministic top pick / open-set line in the Oystehr AI section),
// Area 2 (defense findings, positive state, not-assessed line in the amber box area),
// and the conditional structured length input.
//
// vi.mock calls must come before any component imports (Vitest hoists them).

const { recommendBillingCodesMock, aiSuggestionNotesMock } = vi.hoisted(() => ({
  recommendBillingCodesMock: vi.fn(),
  aiSuggestionNotesMock: vi.fn(),
}));

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
  useAppointmentData: () => ({ encounter: { id: 'enc-coding-assist-test' } }),
  useChartData: () => ({ chartData: {}, setPartialChartData: vi.fn() }),
  useSaveChartData: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
  useDeleteChartData: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useGetCPTHCPCSSearch: () => ({ isFetching: false, data: { codes: [] } }),
  useRecommendBillingCodes: () => ({ mutateAsync: recommendBillingCodesMock }),
  useAiSuggestionNotes: () => ({ mutateAsync: aiSuggestionNotesMock }),
}));

vi.mock('../../src/components/AccordionCard', () => ({
  AccordionCard: ({ children }: any) => <div>{children}</div>,
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

// Container passes children through (the real one only adds the header/icon chrome).
vi.mock('../../src/features/visits/shared/components/AiSection', () => ({
  AiSectionContainer: ({ children }: any) => <div data-testid="ai-section">{children}</div>,
}));

vi.mock('../../src/api/api', () => ({
  createProcedureQuickPick: vi.fn(),
  getProcedureQuickPicks: vi.fn().mockResolvedValue({ quickPicks: [] }),
  updateProcedureQuickPick: vi.fn(),
}));

// Component and store imports come after all vi.mock calls.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProceduresNew from '../../src/features/visits/in-person/pages/ProceduresNew';
import { useProcedureStore } from '../../src/state/draft-data.store';

const ENCOUNTER_ID = 'enc-coding-assist-test';

// Fully-documented intermediate hand laceration → deterministic 12042.
const DETERMINED_DRAFT = {
  procedureType: 'Laceration Repair',
  bodySite: 'Hand',
  bodySide: 'Left',
  procedureDetails:
    'Layered closure: deep dermal 4-0 Vicryl, skin closed with running 5-0 nylon, total stitch count: 8. ' +
    'Wound length: 3.2 cm. Lidocaine 1% infiltrated. Wound irrigated with NS. Tetanus up to date.',
};

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

describe('ProceduresNew — deterministic coding assist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recommendBillingCodesMock.mockResolvedValue([]);
    aiSuggestionNotesMock.mockResolvedValue(undefined);
    useProcedureStore.getState().clearDraft(ENCOUNTER_ID);
    // Stub fetch so the PDF-check useEffect does not trigger the no-network guard.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, headers: { get: () => '' } }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useProcedureStore.getState().clearDraft(ENCOUNTER_ID);
  });

  // --- Area 1: deterministic top pick ---

  it('renders the deterministic best-match row when the documentation determines the code', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, DETERMINED_DRAFT);
    renderComponent();
    expect(
      await screen.findByText(/best match — from your documentation/i, undefined, { timeout: 3000 })
    ).toBeVisible();
    const bestMatch = screen.getByTestId('best-match-cpt-code');
    expect(bestMatch).toHaveTextContent('12042');
    // Justification comes from the engine and names the determinants.
    expect(bestMatch).toHaveTextContent(/layered closure documented/i);
    expect(bestMatch).toHaveTextContent(/3\.2 cm/);
  });

  it('dedupes the AI list against the deterministic pick', async () => {
    recommendBillingCodesMock.mockResolvedValue([
      { code: '12042', description: 'Repair intermediate 2.6-7.5cm', useWhen: 'when' },
      { code: '99213', description: 'Office visit', useWhen: 'when' },
    ]);
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, DETERMINED_DRAFT);
    renderComponent();
    await screen.findByText(/best match — from your documentation/i, undefined, { timeout: 3000 });
    await waitFor(() => {
      // 12042 appears exactly once (the best-match row), 99213 stays in the AI list.
      expect(screen.getAllByTestId('recommended-cpt-code-12042')).toHaveLength(1);
      expect(screen.getByTestId('recommended-cpt-code-99213')).toBeVisible();
    });
  });

  it('renders the compact open-set line when class and site are known but length is missing', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'Laceration Repair',
      bodySite: 'Hand',
      procedureDetails: 'Layered closure: deep dermal 4-0 Vicryl, skin closed with running 5-0 nylon.',
    });
    renderComponent();
    expect(
      await screen.findByText('12041–12047 — wound length (cm) determines the exact code', undefined, { timeout: 3000 })
    ).toBeVisible();
    expect(screen.queryByTestId('best-match-cpt-code')).not.toBeInTheDocument();
  });

  it('renders no coding-assist elements for an unrelated procedure with no findings', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'EKG',
      cptCodes: [{ code: '93000', display: 'Electrocardiogram, complete' }],
    });
    renderComponent();
    // Give the debounced evaluation time to run, then assert nothing new rendered.
    await waitFor(
      () => {
        expect(screen.queryByTestId('best-match-cpt-code')).not.toBeInTheDocument();
        expect(screen.queryByTestId('open-candidates-line')).not.toBeInTheDocument();
        expect(screen.queryByTestId('coding-defense-findings')).not.toBeInTheDocument();
        expect(screen.queryByTestId('coding-defense-supported')).not.toBeInTheDocument();
        expect(screen.queryByTestId('coding-defense-not-assessed')).not.toBeInTheDocument();
      },
      { timeout: 1500 }
    );
  });

  // --- Area 2: documentation defense ---

  it('renders defense findings grouped per selected code, with the contradiction citation', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      ...DETERMINED_DRAFT,
      cptCodes: [{ code: '12002', display: 'Simple repair 2.6-7.5cm' }],
    });
    renderComponent();
    const findings = await screen.findByTestId('coding-defense-findings', undefined, { timeout: 3000 });
    expect(findings).toHaveTextContent('12002');
    expect(findings).toHaveTextContent(/simple-repair code, but the note documents/i);
    // Contradiction lines cite the provider's own documentation.
    expect(findings).toHaveTextContent(/layered closure/i);
    // The amber box header is preserved.
    expect(screen.getByText('Procedure Details AI Suggestions')).toBeVisible();
  });

  it('renders the quiet positive state with the rules vintage when all selected codes are supported', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      ...DETERMINED_DRAFT,
      cptCodes: [{ code: '12042', display: 'Repair intermediate 2.6-7.5cm' }],
    });
    renderComponent();
    const supported = await screen.findByTestId('coding-defense-supported', undefined, { timeout: 3000 });
    expect(supported).toHaveTextContent('Documentation supports 12042');
    expect(supported).toHaveTextContent(/CPT 2026/);
    expect(screen.queryByTestId('coding-defense-findings')).not.toBeInTheDocument();
  });

  it('renders a neutral not-assessed line for uncovered codes when other assist elements are visible', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      ...DETERMINED_DRAFT,
      cptCodes: [
        { code: '12042', display: 'Repair intermediate 2.6-7.5cm' },
        { code: '99214', display: 'Office visit' },
      ],
    });
    renderComponent();
    const notAssessed = await screen.findByTestId('coding-defense-not-assessed', undefined, { timeout: 3000 });
    expect(notAssessed).toHaveTextContent('99214 — not assessed by documentation checks');
  });

  it('preserves the legacy laceration suggestion note alongside the new findings (B6)', async () => {
    aiSuggestionNotesMock.mockResolvedValue({ suggestions: ['Please include suture size and count'] });
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      ...DETERMINED_DRAFT,
      cptCodes: [{ code: '12002', display: 'Simple repair 2.6-7.5cm' }],
    });
    renderComponent();
    expect(await screen.findByText('Please include suture size and count', undefined, { timeout: 3000 })).toBeVisible();
    expect(await screen.findByTestId('coding-defense-findings', undefined, { timeout: 3000 })).toBeVisible();
  });

  // --- Conditional structured length input ---

  it('shows the length input for a laceration-family procedure type', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, { procedureType: 'Laceration Repair' });
    renderComponent();
    expect(await screen.findByTestId('length-cm-input')).toBeVisible();
  });

  it('hides the length input for a procedure type outside length-based families', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, { procedureType: 'EKG' });
    renderComponent();
    await waitFor(() => {
      expect(screen.queryByTestId('length-cm-input')).not.toBeInTheDocument();
    });
  });

  it('restores a saved length value into the input', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, { procedureType: 'Laceration Repair', lengthCm: 3.2 });
    renderComponent();
    const input = (await screen.findByTestId('length-cm-input')).querySelector('input');
    expect(input).toHaveValue(3.2);
  });
});
