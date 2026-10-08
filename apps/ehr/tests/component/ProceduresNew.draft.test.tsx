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

const TEST_QUICK_PICK = {
  id: 'qp-1',
  name: 'Test Quick Pick',
  procedureType: 'laceration-repair',
  procedureDetails: 'Quick pick procedure details',
  cptCodes: [{ code: '12042', display: 'Intermediate repair' }],
  lengthCm: 3.2,
  repairDepth: 'subcutaneous-layered',
};

vi.mock('../../src/hooks/useMergedQuickPicks', () => ({
  sortQuickPicks: vi.fn(),
  useMergedProcedureQuickPicks: () => ({ quickPicks: [TEST_QUICK_PICK], loading: false, refetch: vi.fn() }),
}));

vi.mock('../../src/shared/hooks/useDebounce', () => ({
  useDebounce: () => ({ debounce: (cb: () => void) => cb() }),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));

const { mockSaveChartData, mockDeleteChartData } = vi.hoisted(() => ({
  mockSaveChartData: vi.fn().mockResolvedValue({ chartData: { procedures: [{ resourceId: 'saved-proc-1' }] } }),
  mockDeleteChartData: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ encounter: { id: 'enc-procedure-test' } }),
  useSaveChartData: () => ({ mutateAsync: mockSaveChartData }),
  useDeleteChartData: () => ({ mutateAsync: mockDeleteChartData }),
}));

const { mockChartData } = vi.hoisted(() => ({
  mockChartData: {} as { diagnosis?: { code: string; display: string; isPrimary: boolean; resourceId?: string }[] },
}));

vi.mock('../../src/features/visits/shared/hooks/useChartData', () => ({
  useChartData: () => ({ chartData: mockChartData, setPartialChartData: vi.fn() }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useGetCPTHCPCSSearch: () => ({ isFetching: false, data: { codes: [] } }),
  useICD10SearchNew: () => ({ isFetching: false, data: { codes: [] } }),
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
  RoundedButton: ({ children, onClick, disabled, 'data-testid': dataTestId }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid={dataTestId}>
      {children}
    </button>
  ),
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
  QuickPicksButton: ({ quickPicks, onSelect }: any) => (
    <button onClick={() => onSelect(quickPicks[0])}>Select Quick Pick</button>
  ),
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
import { dataTestIds } from '../../src/constants/data-test-ids';
import { OTHER } from '../../src/features/visits/in-person/pages/procedureOtherFields';
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
      <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>{children}</BrowserRouter>
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

  // --- Standard fields a family omits ---

  it('hides the standard fields EKG omits but keeps consent and instructions', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, { procedureType: 'EKG' });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId(dataTestIds.documentProcedurePage.postProcedureInstructions)).toBeInTheDocument();
    });
    expect(screen.queryByTestId(dataTestIds.documentProcedurePage.technique)).not.toBeInTheDocument();
    expect(screen.queryByTestId(dataTestIds.documentProcedurePage.specimenSent)).not.toBeInTheDocument();
    expect(screen.queryByText('Technique')).not.toBeInTheDocument();
    expect(screen.getByTestId(dataTestIds.documentProcedurePage.consentForProcedure)).toBeInTheDocument();
  });

  it('still shows an omitted EKG field that already has a value', async () => {
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, { procedureType: 'EKG', timeSpent: '< 5 min' });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId(dataTestIds.documentProcedurePage.timeSpent)).toBeInTheDocument();
    });
    expect(screen.queryByTestId(dataTestIds.documentProcedurePage.complications)).not.toBeInTheDocument();
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

  // --- Quick Picks persist to the draft ---

  it('selecting a quick pick persists its procedureType to the draft', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /select quick pick/i }));
    await waitFor(() => {
      expect(useProcedureStore.getState().getDraft(ENCOUNTER_ID).procedureType).toBe(TEST_QUICK_PICK.procedureType);
    });
  });

  it('selecting a quick pick persists its other fields to the draft', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /select quick pick/i }));
    await waitFor(() => {
      expect(useProcedureStore.getState().getDraft(ENCOUNTER_ID).procedureDetails).toBe(
        TEST_QUICK_PICK.procedureDetails
      );
      expect(useProcedureStore.getState().getDraft(ENCOUNTER_ID).lengthCm).toBe(TEST_QUICK_PICK.lengthCm);
      expect(useProcedureStore.getState().getDraft(ENCOUNTER_ID).repairDepth).toBe(TEST_QUICK_PICK.repairDepth);
    });
  });
});

describe('ProceduresNew — Other field fallback on save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProcedureStore.getState().clearDraft(ENCOUNTER_ID);
    // Stub fetch so the PDF-check useEffect does not trigger the no-network guard.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, headers: { get: () => '' } }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const saveDraftAndSubmit = async (draft: Record<string, unknown>): Promise<void> => {
    const user = userEvent.setup();
    useProcedureStore.getState().setDraft(ENCOUNTER_ID, draft);
    renderComponent();
    await user.click(screen.getByTestId(dataTestIds.documentProcedurePage.saveButton));
    await waitFor(() => {
      expect(mockSaveChartData).toHaveBeenCalledTimes(2);
    });
  };

  it('falls back to "Other" for bodySite when otherBodySite is blank, instead of sending an empty string', async () => {
    await saveDraftAndSubmit({ bodySite: OTHER, otherBodySite: undefined });
    const procedurePayload = mockSaveChartData.mock.calls[1][0].procedures[0];
    expect(procedurePayload.bodySite).toBe(OTHER);
  });

  it('falls back to "Other" for bodySite when otherBodySite is only whitespace', async () => {
    await saveDraftAndSubmit({ bodySite: OTHER, otherBodySite: '   ' });
    const procedurePayload = mockSaveChartData.mock.calls[1][0].procedures[0];
    expect(procedurePayload.bodySite).toBe(OTHER);
  });

  it('uses the trimmed otherBodySite text when it is non-blank', async () => {
    await saveDraftAndSubmit({ bodySite: OTHER, otherBodySite: '  Left elbow  ' });
    const procedurePayload = mockSaveChartData.mock.calls[1][0].procedures[0];
    expect(procedurePayload.bodySite).toBe('Left elbow');
  });

  it('falls back to "Other" for complications when otherComplications is blank, instead of sending an empty string', async () => {
    await saveDraftAndSubmit({ complications: OTHER, otherComplications: undefined });
    const procedurePayload = mockSaveChartData.mock.calls[1][0].procedures[0];
    expect(procedurePayload.complications).toBe(OTHER);
  });

  it('uses the trimmed otherComplications text when it is non-blank', async () => {
    await saveDraftAndSubmit({ complications: OTHER, otherComplications: '  Minor bleeding  ' });
    const procedurePayload = mockSaveChartData.mock.calls[1][0].procedures[0];
    expect(procedurePayload.complications).toBe('Minor bleeding');
  });
});

describe('ProceduresNew — sentence layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProcedureStore.getState().clearDraft(ENCOUNTER_ID);
    delete mockChartData.diagnosis;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, headers: { get: () => '' } }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('offers the visit diagnoses as one-click picks and links the charted Condition on save', async () => {
    const user = userEvent.setup();
    mockChartData.diagnosis = [
      { code: 'S61.411A', display: 'Laceration of right hand', isPrimary: true, resourceId: 'cond-1' },
      { code: 'J06.9', display: 'Acute URI', isPrimary: false, resourceId: 'cond-2' },
      // The same code charted twice (e.g. by an earlier procedure) is offered once.
      { code: 'J06.9', display: 'Acute URI', isPrimary: false, resourceId: 'cond-3' },
    ];
    renderComponent();

    await user.click(screen.getByTestId(dataTestIds.documentProcedurePage.addDiagnosis));
    // The charted diagnoses are listed as soon as the popover opens, before anything is typed.
    expect(screen.getAllByRole('option', { name: 'J06.9 Acute URI' })).toHaveLength(1);
    await user.click(screen.getByRole('option', { name: 'S61.411A Laceration of right hand' }));
    expect(screen.getByTestId(dataTestIds.documentProcedurePage.diagnosis)).toHaveTextContent(
      'Laceration of right hand S61.411A'
    );

    // A diagnosis already on the procedure is not offered again.
    await user.click(screen.getByTestId(dataTestIds.documentProcedurePage.addDiagnosis));
    expect(screen.getByRole('option', { name: 'J06.9 Acute URI' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'S61.411A Laceration of right hand' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByTestId(dataTestIds.documentProcedurePage.saveButton));
    await waitFor(() => {
      expect(mockSaveChartData).toHaveBeenCalledTimes(2);
    });
    // Nothing new to create: the charted Condition is linked by its resourceId.
    expect(mockSaveChartData.mock.calls[0][0].diagnosis).toEqual([]);
    expect(mockSaveChartData.mock.calls[1][0].procedures[0].diagnoses).toEqual([
      expect.objectContaining({ code: 'S61.411A', resourceId: 'cond-1' }),
    ]);
  });

  it('starts every blank empty and saves picks as their stored values', async () => {
    const user = userEvent.setup();
    renderComponent();
    const consent = screen.getByTestId(dataTestIds.documentProcedurePage.consentForProcedure);
    expect(consent).toHaveTextContent('consent');
    expect(screen.getByTestId(dataTestIds.documentProcedurePage.specimenSent)).toHaveTextContent('specimen');
    expect(screen.getByTestId(dataTestIds.documentProcedurePage.performedBy)).toHaveTextContent('performed by');

    await user.click(consent);
    await user.click(screen.getByRole('option', { name: 'obtained' }));
    expect(consent).toHaveTextContent('obtained');
    await user.click(screen.getByTestId(dataTestIds.documentProcedurePage.specimenSent));
    await user.click(screen.getByRole('option', { name: 'not sent' }));
    // "Both" is stored as-is but reads as its display wording in the sentence.
    await user.click(screen.getByTestId(dataTestIds.documentProcedurePage.performedBy));
    await user.click(screen.getByRole('option', { name: 'provider and healthcare staff' }));
    expect(screen.getByTestId(dataTestIds.documentProcedurePage.performedBy)).toHaveTextContent(
      'provider and healthcare staff'
    );

    await user.click(screen.getByTestId(dataTestIds.documentProcedurePage.saveButton));
    await waitFor(() => {
      expect(mockSaveChartData).toHaveBeenCalledTimes(2);
    });
    const procedurePayload = mockSaveChartData.mock.calls[1][0].procedures[0];
    expect(procedurePayload).toMatchObject({ consentObtained: true, specimenSent: false, performerType: 'Both' });
  });
});
