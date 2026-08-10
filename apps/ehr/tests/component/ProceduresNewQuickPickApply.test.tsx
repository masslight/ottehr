// Component tests for the quick-pick wiring of the structured procedure fields on ProceduresNew:
// applying a quick pick prefills lengthCm / repairDepth / infusion times (QUICK_PICK_APPLY_KEYS),
// and "Save as Quick Pick" carries the same fields into the created quick pick.
//
// vi.mock calls must come before any component imports (Vitest hoists them).

const { recommendBillingCodesMock, aiSuggestionNotesMock, saveChartDataMock, createProcedureQuickPickMock } =
  vi.hoisted(() => ({
    recommendBillingCodesMock: vi.fn(),
    aiSuggestionNotesMock: vi.fn(),
    saveChartDataMock: vi.fn(),
    createProcedureQuickPickMock: vi.fn(),
  }));

// Quick picks store procedureType as the code slug (see buildQuickPickFromCurrentState);
// family detection accepts the slugs, so the conditional inputs appear after apply.
const { quickPicksMock } = vi.hoisted(() => ({
  quickPicksMock: [
    {
      id: 'qp-laceration',
      name: 'Lac repair preset',
      procedureType: 'laceration-repair',
      lengthCm: 3.2,
      repairDepth: 'subcutaneous-layered',
    },
    {
      id: 'qp-infusion',
      name: 'IV fluids preset',
      procedureType: 'iv-fluid-administration',
      infusionStartTime: '14:05',
      infusionStopTime: '14:47',
    },
  ],
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
  useMergedProcedureQuickPicks: () => ({ quickPicks: quickPicksMock, loading: false, refetch: vi.fn() }),
}));

vi.mock('../../src/shared/hooks/useDebounce', () => ({
  useDebounce: () => ({ debounce: (cb: () => void) => cb() }),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ encounter: { id: 'enc-quick-pick-apply-test' } }),
  useChartData: () => ({ chartData: {}, setPartialChartData: vi.fn() }),
  useSaveChartData: () => ({ mutateAsync: saveChartDataMock }),
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

// The real QuickPicksButton is menu chrome; the mock exposes each pick and the
// add-to-quick-picks trigger as plain buttons so the page callbacks can be driven directly.
vi.mock('../../src/features/visits/shared/components/QuickPicksButton', () => ({
  QuickPicksButton: ({ quickPicks, onSelect, onAddOrUpdate }: any) => (
    <div>
      {quickPicks.map((quickPick: any) => (
        <button key={quickPick.id} onClick={() => onSelect(quickPick)}>
          {`apply-${quickPick.name}`}
        </button>
      ))}
      <button onClick={() => onAddOrUpdate()}>open-quick-pick-dialog</button>
    </div>
  ),
}));

vi.mock('../../src/features/visits/shared/components/assessment-tab/DiagnosesField', () => ({
  DiagnosesField: () => <div />,
}));

vi.mock('../../src/features/visits/in-person/components/InfoAlert', () => ({
  InfoAlert: () => <div />,
}));

vi.mock('../../src/features/visits/shared/components/AiSection', () => ({
  AiSectionContainer: ({ children }: any) => <div data-testid="ai-section">{children}</div>,
}));

vi.mock('../../src/api/api', () => ({
  createProcedureQuickPick: createProcedureQuickPickMock,
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

const ENCOUNTER_ID = 'enc-quick-pick-apply-test';

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

describe('ProceduresNew — quick picks and the structured fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recommendBillingCodesMock.mockResolvedValue([]);
    aiSuggestionNotesMock.mockResolvedValue(undefined);
    saveChartDataMock.mockResolvedValue({});
    createProcedureQuickPickMock.mockResolvedValue({});
    useProcedureStore.getState().clearDraft(ENCOUNTER_ID);
    // Stub fetch so the PDF-check useEffect does not trigger the no-network guard.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, headers: { get: () => '' } }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useProcedureStore.getState().clearDraft(ENCOUNTER_ID);
  });

  it('applying a laceration quick pick prefills wound size and repair depth', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(await screen.findByText('apply-Lac repair preset'));

    // The family-conditional inputs appear (laceration family) with the quick pick's values.
    const lengthInput = (await screen.findByTestId('length-cm-input')).querySelector('input');
    expect(lengthInput).toHaveValue(3.2);
    // The select shows the option label resolved from the stored code.
    expect(screen.getByTestId('repair-depth-select')).toHaveTextContent('Subcutaneous — layered closure');
  });

  it('applying an infusion quick pick prefills start/stop times (duration caption proves both)', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(await screen.findByText('apply-IV fluids preset'));

    await screen.findByTestId('infusion-start-time-input');
    expect(await screen.findByTestId('infusion-duration-caption')).toHaveTextContent('42 min');
  });

  it('"Save as Quick Pick" carries the structured fields into the created quick pick', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, {
      procedureType: 'Laceration Repair',
      lengthCm: 2.5,
      repairDepth: 'superficial-single',
      infusionStartTime: '09:00',
      infusionStopTime: '09:45',
    });
    const user = userEvent.setup();
    renderComponent();

    await user.click(await screen.findByText('open-quick-pick-dialog'));
    // The suggested name is prefilled from the procedure type, so save is enabled immediately.
    await user.click(await screen.findByRole('button', { name: 'Save Quick Pick' }));

    await waitFor(() => {
      expect(createProcedureQuickPickMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          quickPick: expect.objectContaining({
            lengthCm: 2.5,
            repairDepth: 'superficial-single',
            infusionStartTime: '09:00',
            infusionStopTime: '09:45',
          }),
        })
      );
    });
  });
});
