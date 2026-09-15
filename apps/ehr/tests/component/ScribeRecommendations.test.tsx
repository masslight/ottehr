import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ChartPlanResponse } from 'utils/lib/easy-chart/api';
import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StepOutcome } from '../../src/features/easy-chart/executor/types';

// ============================================================================
// FIXTURES — what the plan endpoint answers for the sample transcript
// ============================================================================

const envelope = { usage: [], escalation: { attempts: 1, escalated: false, failures: [] }, triggers: [] };

const PLAN: ChartPlanResponse = {
  actions: [
    {
      kind: 'apply-template',
      display: 'Sinusitis',
      templateId: 't-1',
      sourceText: 'This sounds like a sinus infection on top of the drip.',
    },
    {
      kind: 'edit-note-text',
      field: 'historyOfPresentIllness',
      newText: 'Patient reports having post-nasal drip and sinus pressure for 1 week.',
      sourceText: "I've had this post-nasal drip and pressure in my sinuses for about a week now.",
    },
    {
      kind: 'add-ros-finding',
      display: 'reports eye discharge',
      finding: 'reports',
      sourceText: 'Just some crust in the morning, a little watery.',
    },
    {
      kind: 'add-ros-finding',
      display: 'denies fever',
      finding: 'denies',
      sourceText: 'No fever. I checked a couple of times.',
    },
    { kind: 'add-ros-finding', display: 'denies ear pain', finding: 'denies', sourceText: 'No ear pain.' },
    { kind: 'add-ros-finding', display: 'denies sore throat', finding: 'denies', sourceText: "My throat's fine too." },
    {
      kind: 'add-ros-finding',
      display: 'reports headache',
      finding: 'reports',
      sourceText: "Yeah, headaches most afternoons. That's when it's the worst.",
    },
    {
      kind: 'add-ros-finding',
      display: 'denies post-nasal drip',
      finding: 'denies',
      sourceText: 'Not so much anymore, honestly. It was the first few days.',
      caution: 'Possible conflict: the HPI records post-nasal drip as a presenting complaint.',
    },
    {
      kind: 'add-ros-finding',
      display: 'reports sinus pain/pressure',
      finding: 'reports',
      sourceText: "It's really the sinuses, right here across my cheeks and forehead.",
    },
    {
      kind: 'set-vital',
      field: 'vital-weight',
      display: '170 pounds',
      value: 170,
      unit: 'lb',
      sourceText: "I'm about 170 pounds.",
      caution: 'Patient-reported, not measured.',
    },
    { kind: 'add-allergy', display: 'Fentanyl', sourceText: 'Fentanyl. I had a bad reaction after my knee surgery.' },
    {
      kind: 'add-medication',
      display: 'Ibuprofen',
      sourceText: "Ibuprofen when the headache gets bad. I don't remember the dose.",
    },
    {
      kind: 'add-medication',
      display: 'Claritin (loratadine)',
      sourceText: 'And a sinus allergy med, Claritin or something like it, the one my wife takes.',
      caution:
        'Patient described "a sinus allergy med"; Claritin is a best guess. Confirm the product before applying.',
    },
    { kind: 'add-diagnosis', code: 'R09.82', display: 'Postnasal drip', sourceText: 'post-nasal drip' },
    {
      kind: 'add-diagnosis',
      code: 'J01.90',
      display: 'Acute sinusitis, unspecified',
      isPrimary: true,
      sourceText: 'sinus infection',
    },
    {
      kind: 'add-diagnosis',
      code: 'R42',
      display: 'Dizziness and giddiness',
      sourceText: 'I get a little dizzy when I stand up too fast.',
    },
    // Inferred — no quote — and with no editor of its own in the panel.
    { kind: 'add-exam-finding', display: 'Sinus tenderness' },
    // A vital other than weight: a generic row too, edited by its reading.
    { kind: 'set-vital', field: 'vital-temperature', display: '100.4 F', value: 100.4, unit: 'F', sourceText: '100.4' },
    {
      kind: 'provider-note',
      text: 'The patient mentioned a knee surgery; consider adding it to the surgical history.',
    },
  ],
  rejected: [
    {
      kind: 'set-vital',
      display: '5.8',
      reason: '"5.8" has no unit — a bare height could be centimetres or inches, so it needs confirming',
    },
  ],
  ...envelope,
};

/** The ids the mapping gives the fixture's recommendations: the pass, the action kind and what it names. */
const ID = {
  template: 'plan:apply-template:Sinusitis',
  hpi: 'plan:edit-note-text:historyOfPresentIllness',
  eyeDischarge: 'plan:add-ros-finding:reports-eye-discharge',
  fever: 'plan:add-ros-finding:denies-fever',
  headache: 'plan:add-ros-finding:reports-headache',
  postNasalDrip: 'plan:add-ros-finding:denies-post-nasal-drip',
  weight: 'plan:set-vital:vital-weight',
  fentanyl: 'plan:add-allergy:Fentanyl',
  ibuprofen: 'plan:add-medication:Ibuprofen',
  claritin: 'plan:add-medication:Claritin-loratadine',
  dxDrip: 'plan:add-diagnosis:R09-82',
  dxSinusitis: 'plan:add-diagnosis:J01-90',
  dxDizziness: 'plan:add-diagnosis:R42',
  examTenderness: 'plan:add-exam-finding:Sinus-tenderness',
  temperature: 'plan:set-vital:vital-temperature',
};

// ============================================================================
// MOCKS
// ============================================================================

const mocks = vi.hoisted(() => ({
  /** Resolves to nothing for an applied row, to an outcome to settle it another way, or throws to fail it. */
  applyOne: vi.fn(async (_recommendation: unknown): Promise<unknown> => undefined),
  plan: vi.fn((): unknown => undefined),
  /** Note fields already written on the chart, keyed by clinical name. */
  written: {} as Record<string, string>,
  enqueueSnackbar: vi.fn(),
  navigate: vi.fn(),
  // What the chart already holds. The charted predicate itself is left real.
  chartData: {} as Record<string, unknown>,
  chartFields: {} as Record<string, unknown>,
  vitals: undefined as Record<string, unknown> | undefined,
}));

// The endpoint is replaced by a fixture; the mapping from its actions to recommendations is the real one.
vi.mock('../../src/features/visits/shared/components/scribe-recommendations/useScribeAnalyzer', async () => {
  const { buildAnalysis } = await import('../../src/features/visits/shared/components/scribe-recommendations/analysis');
  return {
    useScribeAnalyzer: () => async (transcript: string) =>
      buildAnalysis(mocks.plan() as ChartPlanResponse, undefined, { written: mocks.written, transcript }),
  };
});

// Keep the real orchestration (selection, ordering, statuses); stub only the chart writes.
vi.mock('../../src/features/visits/shared/components/scribe-recommendations/useApplyRecommendations', async () => {
  const { applyRecommendations, errorMessage, pendingObservationIds } = await import(
    '../../src/features/visits/shared/components/scribe-recommendations/applyRecommendations'
  );
  const run = async (
    recommendations: { id: string }[],
    report: { start(id: string): void; settle(id: string, outcome: StepOutcome): void }
  ): Promise<void> => {
    for (const rec of recommendations) {
      report.start(rec.id);
      try {
        const outcome = (await mocks.applyOne(rec)) as StepOutcome | undefined;
        report.settle(rec.id, outcome ?? { status: 'applied', createdResourceIds: [] });
      } catch (error) {
        report.settle(rec.id, { status: 'failed', reason: errorMessage(error) });
      }
    }
  };
  return {
    useApplyRecommendations: () => ({
      applyObservations: () => applyRecommendations(pendingObservationIds(), run, { mode: 'bulk' }),
      applyRecommendation: (id: string) => applyRecommendations([id], run, { mode: 'interactive' }),
    }),
  };
});

vi.mock('../../src/features/visits/shared/components/templates/TemplatePreviewDialog', () => ({
  TemplatePreviewDialog: ({
    open,
    templateId,
    templateName,
    isApplying,
    onCancel,
    onApply,
  }: {
    open: boolean;
    templateId: string | null;
    templateName: string;
    isApplying: boolean;
    onCancel: () => void;
    onApply: (actions: Record<string, string>) => void;
  }) =>
    open ? (
      <div data-testid="template-preview-dialog">
        <span>{`Preview ${templateName} (${templateId ?? 'none'})`}</span>
        <button data-testid="preview-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button
          data-testid="preview-apply"
          disabled={isApplying}
          onClick={() => onApply({ hpi: 'append', ros: 'skip', mdm: 'overwrite' })}
        >
          Apply chosen sections
        </button>
      </div>
    ) : null,
}));

vi.mock('../../src/features/visits/shared/components/templates/useListTemplates', () => ({
  useListTemplates: () => ({
    templates: [
      { id: 't-1', value: 'Sinusitis', label: 'Sinusitis', isCurrentVersion: true },
      { id: 't-2', value: 'Sinusitis: Wait See', label: 'Sinusitis: Wait See', isCurrentVersion: true },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ encounter: { id: 'encounter-1' } }),
  useChartData: () => ({ chartData: mocks.chartData }),
}));

vi.mock('../../src/features/visits/shared/hooks/useChartFields', () => ({
  useChartFields: () => ({ data: mocks.chartFields }),
}));

vi.mock('../../src/features/visits/shared/components/vitals/hooks/useGetVitals', () => ({
  useGetVitals: () => ({ data: mocks.vitals }),
}));

// ICD-10 search needs the API; the editor just needs something that calls back with a code.
vi.mock('../../src/features/visits/shared/components/assessment-tab/DiagnosesField', () => ({
  DiagnosesField: ({ onChange }: { onChange: (data: { code: string; display: string }) => void }) => (
    <button
      data-testid="pick-diagnosis"
      onClick={() => onChange({ code: 'J01.00', display: 'Acute maxillary sinusitis' })}
    >
      Pick diagnosis
    </button>
  ),
}));

vi.mock('notistack', () => ({
  enqueueSnackbar: (...args: unknown[]) => mocks.enqueueSnackbar(...args),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mocks.navigate };
});

import { dataTestIds } from '../../src/constants/data-test-ids';
import {
  applyRecommendations,
  errorMessage,
  pendingObservationIds,
  RecommendationRunner,
} from '../../src/features/visits/shared/components/scribe-recommendations/applyRecommendations';
import {
  buildChartSnapshot,
  isAlreadyCharted,
} from '../../src/features/visits/shared/components/scribe-recommendations/chartedRecommendations';
import { PickerDialog } from '../../src/features/visits/shared/components/scribe-recommendations/PickerDialog';
import {
  SCRIBE_PANEL_DEFAULT_WIDTH,
  useScribeRecommendationsStore,
} from '../../src/features/visits/shared/components/scribe-recommendations/scribeRecommendations.store';
import { ScribeRecommendationsDrawer } from '../../src/features/visits/shared/components/scribe-recommendations/ScribeRecommendationsDrawer';
import { ScribeRecommendation } from '../../src/features/visits/shared/components/scribe-recommendations/types';
import { useRosObservationsStore } from '../../src/features/visits/shared/stores/appointment/ros-observations.store';

// ============================================================================
// HELPERS
// ============================================================================

const testIds = dataTestIds.scribeRecommendations;

const Wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <MemoryRouter initialEntries={['/in-person/appointment-1/review-and-sign']}>{children}</MemoryRouter>
);

const resetStore = (): void => {
  mocks.chartData = {};
  mocks.chartFields = {};
  mocks.vitals = undefined;
  mocks.written = {};
  mocks.plan.mockReturnValue(PLAN);
  useRosObservationsStore.setState({}, true);
  useScribeRecommendationsStore.setState({
    chartedIds: [],
    isOpen: false,
    width: SCRIBE_PANEL_DEFAULT_WIDTH,
    encounterId: undefined,
    transcript: '',
    phase: 'input',
    analysisError: undefined,
    narrative: [],
    recommendations: [],
    itemState: {},
    orderSuggestions: [],
    ordersDone: {},
    rejected: [],
    notes: [],
    isApplying: false,
    editingId: undefined,
    pendingPick: null,
  });
};

const openPanelWithRecommendations = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  render(<ScribeRecommendationsDrawer />, { wrapper: Wrapper });
  await user.click(screen.getByTestId(testIds.openButton));
  await user.click(screen.getByTestId(testIds.useSampleButton));
  await user.click(screen.getByTestId(testIds.analyzeButton));
  await screen.findByTestId(testIds.applyObservationsButton);
};

const rowCheckbox = (id: string): HTMLInputElement =>
  within(screen.getByTestId(testIds.rowCheckbox(id))).getByRole('checkbox') as HTMLInputElement;

/** A row that has landed in the chart says so by turning its own checkbox green, and settling. */
const expectCharted = (id: string): void => {
  expect(rowCheckbox(id)).toBeChecked();
  expect(rowCheckbox(id)).toBeDisabled();
  expect(screen.getByTestId(testIds.rowCheckbox(id))).toHaveClass('MuiCheckbox-colorSuccess');
};

/** Nothing in the editor is confirmed: looking away is what closes it, and what saves it. */
const lookAway = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => user.click(document.body);

/**
 * A pending row carries no box to tick — the tick lives in the editor — so unticking one means
 * opening the line, unticking it there, and looking away again.
 */
const untick = async (user: ReturnType<typeof userEvent.setup>, id: string): Promise<void> => {
  await user.click(screen.getByTestId(testIds.rowEditButton(id)));
  await user.click(rowCheckbox(id));
  await lookAway(user);
};

/** With no box on the line, a row that is not going in says so by striking itself through. */
const expectUnticked = (id: string): void => {
  expect(screen.queryByTestId(testIds.rowCheckbox(id))).toBeNull();
  expect(screen.getByTestId(testIds.rowText(id))).toHaveStyle({ textDecoration: 'line-through' });
};

const observations = (): ScribeRecommendation[] =>
  useScribeRecommendationsStore.getState().recommendations.filter((rec) => rec.section !== 'template');

const appliedIds = (): string[] => mocks.applyOne.mock.calls.map(([rec]) => (rec as ScribeRecommendation).id);

// ============================================================================
// TESTS
// ============================================================================

describe('ScribeRecommendationsDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetStore();
    mocks.applyOne.mockResolvedValue(undefined);
  });

  it('starts as a rail and opens into the transcript step', async () => {
    const user = userEvent.setup();
    render(<ScribeRecommendationsDrawer />, { wrapper: Wrapper });

    expect(screen.getByTestId(testIds.rail)).toBeVisible();
    expect(screen.queryByTestId(testIds.panel)).toBeNull();

    await user.click(screen.getByTestId(testIds.openButton));
    expect(screen.getByTestId(testIds.panel)).toBeVisible();
    expect(screen.getByTestId(testIds.transcriptInput)).toHaveValue('');
    // nothing to analyze yet
    expect(screen.getByTestId(testIds.analyzeButton)).toBeDisabled();

    await user.click(screen.getByTestId(testIds.useSampleButton));
    expect((screen.getByTestId(testIds.transcriptInput) as HTMLTextAreaElement).value).toContain('post-nasal drip');
    expect(screen.getByTestId(testIds.analyzeButton)).toBeEnabled();

    await user.click(screen.getByTestId(testIds.collapseButton));
    expect(screen.getByTestId(testIds.rail)).toBeVisible();
  });

  it('lays the plan out as stages: what it found, the template, the observations, the refusals', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);

    const summary = screen.getByTestId(testIds.stage('summary'));
    const template = screen.getByTestId(testIds.stage('template'));
    const observationsStage = screen.getByTestId(testIds.stage('observations'));

    // the leads carry the sequence, so the stages need no numbering of their own
    expect(
      screen
        .getAllByRole('region')
        .map((section) => section.getAttribute('data-testid'))
        .filter((id) => id?.startsWith('scribe-stage-'))
    ).toEqual(['scribe-stage-summary', 'scribe-stage-template', 'scribe-stage-observations', 'scribe-stage-rejected']);
    expect(within(summary).getByText(/Here’s what I heard/)).toBeVisible();
    expect(within(template).getByText(/template that looks like a good fit/)).toBeVisible();
    expect(within(observationsStage).getByText(/observations, which I read in the transcript/)).toBeVisible();

    // stage one is a single button naming the template the server resolved, not a row in the list below
    expect(within(template).getByTestId(testIds.templateApplyButton)).toHaveTextContent('Apply template: Sinusitis');
    expect(within(template).getByTestId(testIds.templateApplyButton)).toBeEnabled();
    expect(within(template).getByTestId(testIds.goToSectionButton('template'))).toBeVisible();
    expect(screen.queryByTestId(testIds.rowCheckbox(ID.template))).toBeNull();
    expect(screen.queryByTestId(testIds.group('template'))).toBeNull();

    // stage two holds every observation, grouped by the section it writes into. A row with an editor
    // carries no checkbox until it is opened — they are all going in unless the provider says otherwise —
    // and only the generic action row, which has no editor to hold one, keeps its box on the line.
    expect(within(observationsStage).getAllByRole('checkbox')).toHaveLength(2);
    expect(rowCheckbox(ID.examTenderness)).toBeChecked();
    expect(rowCheckbox(ID.temperature)).toBeChecked();
    ['hpi', 'assessment', 'ros', 'exam', 'vitals', 'allergies', 'medications'].forEach((section) => {
      const group = within(observationsStage).getByTestId(testIds.group(section));
      expect(group).toBeVisible();
      // the rail names the section and doubles as the link into that part of the note
      expect(within(group).getByTestId(testIds.goToSectionButton(section))).toBeVisible();
    });
    expect(within(observationsStage).getByTestId(testIds.goToSectionButton('ros'))).toHaveAccessibleName(
      'Open Review of Systems in the note'
    );
    expect(within(screen.getByTestId(testIds.group('medications'))).getByText('Meds')).toBeVisible();
    expect(within(observationsStage).getByText('Acute sinusitis, unspecified (J01.90)')).toBeVisible();
    // an action the panel has no editor for is shown by the executor's own step label
    expect(
      within(screen.getByTestId(testIds.group('exam'))).getByText('Adding exam finding: Sinus tenderness')
    ).toBeVisible();

    expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent(
      `${observations().length} of ${observations().length} selected`
    );
    expect(screen.getByTestId(testIds.applyObservationsButton)).toHaveTextContent(
      `Add ${observations().length} observations`
    );

    await user.click(within(observationsStage).getByTestId(testIds.goToSectionButton('ros')));
    expect(mocks.navigate).toHaveBeenCalledWith('/in-person/appointment-1/review-of-systems');
  });

  it('tells the visit back in the transcript’s own words, with the evidence behind each item highlighted', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);

    // the story is the transcript as pasted, in the first stage
    const narrative = within(screen.getByTestId(testIds.stage('summary'))).getByTestId(testIds.narrative);
    expect(narrative).toHaveTextContent('Provider: Good morning. What brings you in today?');

    // the phrase an item came from is a run linked to it: hovering it lights the row up
    const span = screen.getByTestId(testIds.narrativeSpan(ID.fentanyl));
    expect(span).toHaveTextContent('Fentanyl. I had a bad reaction after my knee surgery.');
    await user.hover(span);
    expect(useScribeRecommendationsStore.getState().hoveredItemId).toBe(ID.fentanyl);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Fentanyl');
    await user.unhover(span);

    // clicking it opens the row right there, straight into its editor, with nothing to press to finish
    await user.click(span);
    const popover = screen.getByTestId(testIds.narrativePopover(ID.fentanyl));
    expect(within(popover).getByTestId(testIds.rowEditInput(ID.fentanyl))).toHaveValue('Fentanyl');
    expect(within(popover).queryByRole('button', { name: /save|cancel/i })).toBeNull();
    await lookAway(user);
    await waitFor(() => expect(screen.queryByTestId(testIds.narrativePopover(ID.fentanyl))).toBeNull());

    // a phrase two items came from — the HPI's sentence and the diagnosis quoted from inside it — opens both
    const shared = screen.getByTestId(testIds.narrativeSpan(`${ID.hpi}+${ID.dxDrip}`));
    expect(shared).toHaveTextContent('post-nasal drip');
    await user.click(shared);
    const sharedPopover = screen.getByTestId(testIds.narrativePopover(`${ID.hpi}+${ID.dxDrip}`));
    expect(within(sharedPopover).getByTestId(testIds.row(ID.hpi))).toBeVisible();
    expect(within(sharedPopover).getByTestId(testIds.row(ID.dxDrip))).toBeVisible();
    // with two to choose from, neither opens itself
    expect(within(sharedPopover).queryByTestId(testIds.rowEditInput(ID.hpi))).toBeNull();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId(testIds.narrativePopover(`${ID.hpi}+${ID.dxDrip}`))).toBeNull());

    // an item left out is struck out in the story too
    await untick(user, ID.fentanyl);
    expect(screen.getByTestId(testIds.narrativeSpan(ID.fentanyl))).toHaveStyle({ textDecoration: 'line-through' });
  });

  it('lists what the server refused, with its reason, and what the assistant said rather than charted', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);

    expect(screen.getByTestId(testIds.rejected)).toHaveTextContent(
      '"5.8" has no unit — a bare height could be centimetres or inches, so it needs confirming'
    );
    expect(screen.getByTestId(testIds.notes)).toHaveTextContent(
      'The patient mentioned a knee surgery; consider adding it to the surgical history.'
    );
  });

  it('puts the primary diagnosis at the head of the assessment group', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);

    const rows = within(screen.getByTestId(testIds.group('assessment'))).getAllByTestId(
      /^scribe-row-plan:add-diagnosis/
    );
    expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual([
      testIds.row(ID.dxSinusitis),
      testIds.row(ID.dxDrip),
      testIds.row(ID.dxDizziness),
    ]);
    expect(within(rows[0]).getByText('Primary')).toBeVisible();
  });

  it('leads each review-of-systems row with the finding, positives first', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);

    // the finding is the single letter the Review of Systems screen heads its columns with
    const findings = within(screen.getByTestId(testIds.group('ros'))).getAllByTestId(/^scribe-row-finding-/);
    // positives carry the clinical weight, so they sit above the denials
    expect(findings.map((letter) => letter.textContent)).toEqual(['R:', 'R:', 'R:', 'D:', 'D:', 'D:', 'D:']);
    expect(screen.queryByText('Reports')).toBeNull();
    expect(screen.queryByText('Denies')).toBeNull();

    // and the finding reads before the system, not after it
    const firstRow = screen.getByTestId(testIds.row(ID.eyeDischarge));
    expect(firstRow.textContent?.indexOf('R:')).toBeLessThan(firstRow.textContent?.indexOf('Eyes: Discharge') ?? -1);
  });

  it('applies the template on its own, leaving the observations untouched', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);

    // the apply button opens the section picker rather than applying everything outright
    await user.click(screen.getByTestId(testIds.templateApplyButton));
    expect(screen.getByTestId('template-preview-dialog')).toHaveTextContent('Preview Sinusitis (t-1)');
    expect(mocks.applyOne).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('preview-cancel'));
    expect(screen.queryByTestId('template-preview-dialog')).toBeNull();
    expect(mocks.applyOne).not.toHaveBeenCalled();

    await user.click(screen.getByTestId(testIds.templateApplyButton));
    await user.click(screen.getByTestId('preview-apply'));
    await waitFor(() => expect(screen.queryByTestId(testIds.templateApplyButton)).toBeNull());

    expect(appliedIds()).toEqual([ID.template]);
    // and the sections chosen in the dialog ride along with it
    expect(mocks.applyOne.mock.calls[0][0]).toMatchObject({
      sectionActions: { hpi: 'append', ros: 'skip', mdm: 'overwrite' },
    });
    expect(screen.queryByTestId('template-preview-dialog')).toBeNull();
    expect(screen.getByTestId(testIds.rowStatus(ID.template))).toHaveTextContent('Sinusitis applied');
    // and settles into the same green tick a charted row shows
    expectCharted(ID.template);
    // the observations are still waiting on their own button
    expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent(
      `${observations().length} of ${observations().length} selected`
    );
    expect(screen.getByTestId(testIds.applyObservationsButton)).toBeEnabled();
  });

  it('charts the whole review from one button: the template first, then the checked observations', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);
    const total = observations().length;

    expect(screen.getByTestId(testIds.chartSummary)).toHaveTextContent(
      `Applies the template and ${total} selected observations`
    );
    await untick(user, ID.claritin);

    await user.click(screen.getByTestId(testIds.chartButton));
    await waitFor(() => expect(mocks.applyOne).toHaveBeenCalledTimes(total));

    // the template goes straight through, without the section picker, on the panel's defaults
    expect(screen.queryByTestId('template-preview-dialog')).toBeNull();
    expect(appliedIds()[0]).toBe(ID.template);
    expect(mocks.applyOne.mock.calls[0][0]).not.toHaveProperty('sectionActions');
    expect(appliedIds()).not.toContain(ID.claritin);
    expect(screen.getByTestId(testIds.rowStatus(ID.template))).toHaveTextContent('Sinusitis applied');
    expectCharted(ID.hpi);

    // nothing selected is left, so the button has nothing to do
    expect(screen.getByTestId(testIds.chartSummary)).toHaveTextContent('Nothing is selected');
    expect(screen.getByTestId(testIds.chartButton)).toBeDisabled();
  });

  it('adds only the checked observations, and never the template', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);
    const total = observations().length;

    await untick(user, ID.claritin);
    expectUnticked(ID.claritin);
    expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent(`${total - 1} of ${total} selected`);

    await user.click(screen.getByTestId(testIds.applyObservationsButton));
    await waitFor(() => expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent(`${total - 1} added`));

    expect(mocks.applyOne).toHaveBeenCalledTimes(total - 1);
    expect(appliedIds()).not.toContain(ID.claritin);
    expect(appliedIds()).not.toContain(ID.template);
    // the preferred primary is written before the other diagnoses
    expect(appliedIds().filter((id) => id.includes(':add-diagnosis:'))[0]).toBe(ID.dxSinusitis);

    // applied rows are settled, and say so in the checkbox rather than in an icon beside it
    expectCharted(ID.hpi);
    // the one that was left out is still a live line, struck through and open to a second thought
    expect(screen.queryByTestId(testIds.rowStatus(ID.claritin))).toBeNull();
    expectUnticked(ID.claritin);
    expect(screen.getByTestId(testIds.rowEditButton(ID.claritin))).toBeInTheDocument();
    expect(screen.getByTestId(testIds.templateApplyButton)).toBeEnabled();
  });

  it('lets a row with no editor be left out from the box on its line', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);
    const total = observations().length;

    await user.click(rowCheckbox(ID.examTenderness));
    expect(rowCheckbox(ID.examTenderness)).not.toBeChecked();
    expect(screen.getByTestId(testIds.rowText(ID.examTenderness))).toHaveStyle({ textDecoration: 'line-through' });
    expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent(`${total - 1} of ${total} selected`);

    await user.click(screen.getByTestId(testIds.applyObservationsButton));
    await waitFor(() => expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent(`${total - 1} added`));
    expect(appliedIds()).not.toContain(ID.examTenderness);
    // and it can be ticked back on
    await user.click(rowCheckbox(ID.examTenderness));
    expect(rowCheckbox(ID.examTenderness)).toBeChecked();
  });

  it('edits a generic row by its wording, and re-reads an edited vital', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);

    // the exam finding is a search term: the words are what the executor looks up
    await user.click(screen.getByTestId(testIds.rowEditButton(ID.examTenderness)));
    const wording = screen.getByTestId(testIds.rowEditInput(ID.examTenderness));
    await user.clear(wording);
    await user.type(wording, 'Maxillary sinus tenderness{Enter}');
    expect(screen.getByTestId(testIds.rowText(ID.examTenderness))).toHaveTextContent(
      'Adding exam finding: Maxillary sinus tenderness'
    );

    // a reading is parsed again as the server parsed it, so the number the chart gets follows the words
    await user.click(screen.getByTestId(testIds.rowEditButton(ID.temperature)));
    const reading = screen.getByTestId(testIds.rowEditInput(ID.temperature));
    await user.clear(reading);
    await user.type(reading, '38.2 C{Enter}');
    expect(screen.getByTestId(testIds.rowText(ID.temperature))).toHaveTextContent('Recording temperature: 38.2 C');

    // a reading that cannot be read keeps the last one
    await user.click(screen.getByTestId(testIds.rowEditButton(ID.temperature)));
    const again = screen.getByTestId(testIds.rowEditInput(ID.temperature));
    await user.clear(again);
    await user.type(again, 'warm{Enter}');
    expect(screen.getByTestId(testIds.rowText(ID.temperature))).toHaveTextContent('Recording temperature: 38.2 C');

    // a coded row has no wording to edit, and says so by offering no pencil
    expect(screen.queryByTestId(testIds.rowEditButton(ID.dxSinusitis))).not.toBeNull();

    await user.click(screen.getByTestId(testIds.applyObservationsButton));
    await waitFor(() =>
      expect(screen.getByTestId(testIds.rowCheckbox(ID.temperature))).toHaveClass('MuiCheckbox-colorSuccess')
    );
    const applied = mocks.applyOne.mock.calls.map(([rec]) => rec as ScribeRecommendation);
    expect(applied.find((rec) => rec.id === ID.examTenderness)).toMatchObject({
      action: { kind: 'add-exam-finding', display: 'Maxillary sinus tenderness' },
    });
    expect(applied.find((rec) => rec.id === ID.temperature)).toMatchObject({
      action: { kind: 'set-vital', display: '38.2 C', value: 38.2, unit: 'C' },
    });
  });

  it('applies the edited version of a recommendation', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);

    await user.click(screen.getByTestId(testIds.rowEditButton(ID.hpi)));
    const input = screen.getByTestId(testIds.rowEditInput(ID.hpi));
    await user.clear(input);
    await user.type(input, 'Post-nasal drip and sinus pressure x 1 week, worse in the afternoons.');
    // Enter is a line break in the HPI box, so this one is committed by looking away
    await lookAway(user);
    expect(
      within(screen.getByTestId(testIds.row(ID.hpi))).getByText(
        'Post-nasal drip and sinus pressure x 1 week, worse in the afternoons.'
      )
    ).toBeVisible();

    await user.click(screen.getByTestId(testIds.rowEditButton(ID.weight)));
    const weightInput = screen.getByTestId(testIds.rowEditInput(ID.weight));
    await user.clear(weightInput);
    await user.type(weightInput, '172');
    await user.keyboard('{Enter}');
    expect(screen.getByText(/Weight 172 lbs/)).toBeVisible();

    await user.click(screen.getByTestId(testIds.rowEditButton(ID.dxDrip)));
    await user.click(screen.getByTestId('pick-diagnosis'));
    await lookAway(user);
    expect(screen.getByText('Acute maxillary sinusitis (J01.00)')).toBeVisible();

    await user.click(screen.getByTestId(testIds.applyObservationsButton));
    await waitFor(() =>
      expect(screen.getByTestId(testIds.rowCheckbox(ID.weight))).toHaveClass('MuiCheckbox-colorSuccess')
    );

    const applied = mocks.applyOne.mock.calls.map(([rec]) => rec as ScribeRecommendation);
    expect(applied.find((rec) => rec.id === ID.hpi)).toMatchObject({
      text: 'Post-nasal drip and sinus pressure x 1 week, worse in the afternoons.',
    });
    expect(applied.find((rec) => rec.id === ID.weight)).toMatchObject({ weightLbs: 172 });
    expect(applied.find((rec) => rec.id === ID.dxDrip)).toMatchObject({ code: 'J01.00' });
  });

  it('lets a failed template be swapped for another and applied again', async () => {
    const user = userEvent.setup();
    mocks.applyOne.mockImplementation(async (rec) => {
      if ((rec as ScribeRecommendation).kind === 'template') throw new Error('Template not available here');
    });
    await openPanelWithRecommendations(user);

    await user.click(screen.getByTestId(testIds.templateApplyButton));
    await user.click(screen.getByTestId('preview-apply'));
    await waitFor(() => expect(screen.getByText('Template not available here')).toBeVisible());
    expect(screen.getByTestId(testIds.templateApplyButton)).toHaveTextContent('Try again');

    // swap in a template this environment actually has
    await user.click(screen.getByTestId(testIds.rowEditButton(ID.template)));
    await user.click(screen.getByTestId(testIds.rowEditInput(ID.template)));
    await user.click(screen.getByRole('option', { name: 'Sinusitis: Wait See' }));
    await lookAway(user);
    // picking a different template clears the failure, so this is a fresh apply rather than a retry
    expect(screen.getByTestId(testIds.templateApplyButton)).toHaveTextContent('Apply template: Sinusitis: Wait See');

    mocks.applyOne.mockResolvedValue(undefined);
    await user.click(screen.getByTestId(testIds.templateApplyButton));
    await user.click(screen.getByTestId('preview-apply'));
    await waitFor(() =>
      expect(screen.getByTestId(testIds.rowStatus(ID.template))).toHaveTextContent('Sinusitis: Wait See applied')
    );
  });

  it('keeps failed observations unapplied with a retry, and skips whatever was unchecked', async () => {
    const user = userEvent.setup();
    mocks.applyOne.mockImplementation(async (rec) => {
      if ((rec as ScribeRecommendation).id === ID.fentanyl) throw new Error('Allergen service is down');
    });
    await openPanelWithRecommendations(user);
    const total = observations().length;

    const rosIds = observations()
      .filter((rec) => rec.section === 'ros')
      .map((rec) => rec.id);
    for (const id of rosIds) {
      await untick(user, id);
    }
    rosIds.forEach((id) => expectUnticked(id));

    await user.click(screen.getByTestId(testIds.applyObservationsButton));
    await waitFor(() =>
      expect(screen.getByTestId(testIds.rowStatus(ID.fentanyl))).toHaveAttribute('aria-label', 'Failed')
    );
    expect(screen.getByText('Allergen service is down')).toBeVisible();
    expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent(`${total - rosIds.length - 1} added`);
    expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent('1 failed');
    expect(appliedIds()).not.toEqual(expect.arrayContaining(rosIds));

    // retry re-runs just what is still selected: the failed allergy
    mocks.applyOne.mockResolvedValue(undefined);
    mocks.applyOne.mockClear();
    await user.click(screen.getByTestId(testIds.rowRetryButton(ID.fentanyl)));
    await waitFor(() =>
      expect(screen.getByTestId(testIds.rowCheckbox(ID.fentanyl))).toHaveClass('MuiCheckbox-colorSuccess')
    );
    expect(appliedIds()).toEqual([ID.fentanyl]);
    // pressing Retry was not an edit, however clickable the rest of the line is
    expect(screen.queryByTestId(testIds.rowEditInput(ID.fentanyl))).toBeNull();
  });

  it('shows a step the executor skipped with its reason, and takes it out of the batch', async () => {
    const user = userEvent.setup();
    const reason = 'no exam finding in the catalogue matches "Sinus tenderness"';
    mocks.applyOne.mockImplementation(async (rec) =>
      (rec as ScribeRecommendation).id === ID.examTenderness ? { status: 'skipped', reason } : undefined
    );
    await openPanelWithRecommendations(user);
    const total = observations().length;

    await user.click(screen.getByTestId(testIds.applyObservationsButton));
    await waitFor(() =>
      expect(screen.getByTestId(testIds.rowStatus(ID.examTenderness))).toHaveAttribute('aria-label', 'Skipped')
    );
    // nothing was written, the row says why, and it is no longer going in unless the provider ticks it again
    expect(screen.getByText(reason)).toBeVisible();
    expect(rowCheckbox(ID.examTenderness)).not.toBeChecked();
    expect(screen.getByTestId(testIds.rowText(ID.examTenderness))).toHaveStyle({ textDecoration: 'line-through' });
    expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent(`${total - 1} added`);
    expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent('1 skipped');
    expect(screen.getByTestId(testIds.rowRetryButton(ID.examTenderness))).toBeVisible();
  });

  it('reads the executor’s note on an applied row, amber when the pick was the assistant’s', async () => {
    const user = userEvent.setup();
    const pick = 'auto-picked from 3 near-equal matches — verify';
    const demoted = 'a primary diagnosis was already set, so this was charted as secondary';
    mocks.applyOne.mockImplementation(async (rec) => {
      const { id } = rec as ScribeRecommendation;
      if (id === ID.ibuprofen) return { status: 'applied', createdResourceIds: [], note: pick, lowConfidence: true };
      if (id === ID.dxDizziness) return { status: 'applied', createdResourceIds: [], note: demoted };
      return undefined;
    });
    await openPanelWithRecommendations(user);

    await user.click(screen.getByTestId(testIds.applyObservationsButton));
    await waitFor(() => expect(screen.getByTestId(testIds.rowNote(ID.ibuprofen))).toHaveTextContent(pick));
    // settled and green like any applied row, with the executor's caution underneath
    expectCharted(ID.ibuprofen);
    expect(screen.getByTestId(testIds.rowNote(ID.dxDizziness))).toHaveTextContent(demoted);
    // a row the executor had nothing to add about carries no note
    expect(screen.queryByTestId(testIds.rowNote(ID.fentanyl))).toBeNull();
  });

  it('starts a rewrite of note text the provider already wrote unticked, flagged with what it replaces', async () => {
    const user = userEvent.setup();
    mocks.written = { historyOfPresentIllness: 'The HPI the provider typed before the transcript arrived.' };
    await openPanelWithRecommendations(user);
    const total = observations().length;

    // it is on the list, but opted into rather than out of
    expectUnticked(ID.hpi);
    const row = screen.getByTestId(testIds.row(ID.hpi));
    expect(
      within(row).getByLabelText(/Replaces the History of Present Illness text already in the note/)
    ).toBeVisible();
    expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent(`${total - 1} of ${total} selected`);

    await user.click(screen.getByTestId(testIds.applyObservationsButton));
    await waitFor(() => expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent(`${total - 1} added`));
    expect(appliedIds()).not.toContain(ID.hpi);
  });

  it('marks recommendations the chart already holds and leaves them out of the batch', async () => {
    const user = userEvent.setup();
    // the visit already has one of the diagnoses and the allergy on it
    mocks.chartData = {
      diagnosis: [{ code: 'R42', display: 'Dizziness and giddiness', isPrimary: false }],
      allergies: [{ name: 'Fentanyl', current: true }],
    };
    await openPanelWithRecommendations(user);

    const chartedRow = screen.getByTestId(testIds.row(ID.dxDizziness));
    expect(within(chartedRow).getByText('Already charted')).toBeVisible();
    expect(rowCheckbox(ID.dxDizziness)).toBeDisabled();
    expect(within(screen.getByTestId(testIds.row(ID.fentanyl))).getByText('Already charted')).toBeVisible();
    // there is nothing to edit about something that is already in the chart
    expect(screen.queryByTestId(testIds.rowEditButton(ID.dxDizziness))).toBeNull();

    const total = observations().length;
    expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent(`${total - 2} of ${total - 2} selected`);
    expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent('2 already charted');
    expect(screen.getByTestId(testIds.applyObservationsButton)).toHaveTextContent(`Add ${total - 2} observations`);

    await user.click(screen.getByTestId(testIds.applyObservationsButton));
    await waitFor(() => expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent(`${total - 2} added`));
    expect(appliedIds()).not.toContain(ID.dxDizziness);
    expect(appliedIds()).not.toContain(ID.fentanyl);
  });

  it('marks a suggestion off as soon as it appears in the chart elsewhere', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);

    expect(within(screen.getByTestId(testIds.row(ID.headache))).queryByText('Already charted')).toBeNull();
    expect(screen.queryByTestId(testIds.rowCheckbox(ID.headache))).toBeNull();
    const before = observations().length;

    // the provider ticks Headache on the Review of Systems screen while the panel is open
    useRosObservationsStore.setState({
      'ros-neuro-headache-reports': { field: 'ros-neuro-headache-reports', label: 'Headache', value: true },
    });

    await waitFor(() =>
      expect(within(screen.getByTestId(testIds.row(ID.headache))).getByText('Already charted')).toBeVisible()
    );
    expectCharted(ID.headache);
    expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent('1 already charted');
    expect(screen.getByTestId(testIds.applyObservationsButton)).toHaveTextContent(`Add ${before - 1} observations`);
  });

  it('keeps the transcript evidence off the row until the pointer is on the line', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);

    const quote = "I'm about 170 pounds.";
    const caution = 'Patient-reported, not measured.';
    // the row shows neither; the quote is on screen only as a run of the transcript above
    const row = screen.getByTestId(testIds.row(ID.weight));
    expect(within(row).queryByText(quote)).toBeNull();
    expect(within(row).queryByText(caution)).toBeNull();

    // hovering the line reads it: there is no "i" to press, and nothing to pin open
    await user.hover(row);
    const tooltip = await screen.findByRole('tooltip');
    expect(within(tooltip).getByText(quote)).toBeVisible();
    expect(within(tooltip).getByText(caution)).toBeVisible();

    await user.unhover(row);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());

    // the caution still flags the row without hovering; a row the AI is sure of carries no flag
    expect(within(row).getByLabelText(caution)).toBeVisible();
    expect(within(screen.getByTestId(testIds.row(ID.dxSinusitis))).queryByRole('img')).toBeNull();

    // an item the model inferred rather than quoted says so on hover
    await user.hover(screen.getByTestId(testIds.row(ID.examTenderness)));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Inferred by the assistant');
  });

  it('opens the editor from anywhere on the line, not just from the pencil', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);

    const row = screen.getByTestId(testIds.row(ID.fentanyl));
    await user.click(within(row).getByText('Fentanyl'));
    // the same editor the narrative popover opens: the tick and the field, and nothing to press
    expect(within(row).getByTestId(testIds.rowEditInput(ID.fentanyl))).toHaveValue('Fentanyl');
    expect(rowCheckbox(ID.fentanyl)).toBeChecked();
    expect(within(row).queryByRole('button', { name: /save|cancel/i })).toBeNull();
    // the pencil has done its job, and the hover is gone while the editor is up
    expect(within(row).queryByTestId(testIds.rowEditButton(ID.fentanyl))).toBeNull();
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());

    // unticking it there is what takes it out of the batch
    await user.click(rowCheckbox(ID.fentanyl));
    await lookAway(user);
    expectUnticked(ID.fentanyl);
    expect(within(row).getByTestId(testIds.rowEditButton(ID.fentanyl))).toBeInTheDocument();

    // a generic action row keeps its box on the line, and opens onto the wording the executor will act on
    const generic = screen.getByTestId(testIds.row(ID.examTenderness));
    expect(rowCheckbox(ID.examTenderness)).toBeChecked();
    await user.click(within(generic).getByText('Adding exam finding: Sinus tenderness'));
    expect(screen.getByTestId(testIds.rowEditInput(ID.examTenderness))).toHaveValue('Sinus tenderness');
    await lookAway(user);

    // and applying the template is not editing which template it is, though its own line is
    // otherwise clickable the same way
    await user.click(screen.getByTestId(testIds.templateApplyButton));
    expect(screen.getByTestId('template-preview-dialog')).toBeVisible();
    expect(screen.queryByTestId(testIds.rowEditInput(ID.template))).toBeNull();
    await user.click(screen.getByTestId('preview-cancel'));

    // the template row's body — everything but the rail — opens its picker wherever it is clicked
    const templateBody = screen.getByTestId(testIds.row(ID.template)).lastElementChild as HTMLElement;
    await user.click(templateBody);
    expect(screen.getByTestId(testIds.rowEditInput(ID.template))).toBeVisible();
  });

  it('keeps one editor open at a time, and saves the one it closes', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);

    await user.click(screen.getByTestId(testIds.rowEditButton(ID.fentanyl)));
    const input = screen.getByTestId(testIds.rowEditInput(ID.fentanyl));
    await user.clear(input);
    await user.type(input, 'Fentanyl patch');

    // clicking another line puts the first one away, with what was typed in it kept — and that
    // is all it does: the line clicked on stays closed until it is clicked on its own
    await user.click(screen.getByTestId(testIds.rowText(ID.claritin)));
    expect(screen.queryByTestId(testIds.rowEditInput(ID.fentanyl))).toBeNull();
    expect(screen.queryByTestId(testIds.rowEditInput(ID.claritin))).toBeNull();
    expect(screen.getByTestId(testIds.rowText(ID.fentanyl))).toHaveTextContent('Fentanyl patch');

    await user.click(screen.getByTestId(testIds.rowText(ID.claritin)));
    expect(screen.getByTestId(testIds.rowEditInput(ID.claritin))).toBeVisible();

    // Escape is a way out like any other, so it keeps the edit rather than dropping it
    const claritin = screen.getByTestId(testIds.rowEditInput(ID.claritin));
    await user.clear(claritin);
    await user.type(claritin, 'Claritin 10mg{Escape}');
    expect(screen.queryByTestId(testIds.rowEditInput(ID.claritin))).toBeNull();
    expect(screen.getByTestId(testIds.rowText(ID.claritin))).toHaveTextContent('Claritin 10mg');

    // and a line that was only looked at is not an edit
    await user.click(screen.getByTestId(testIds.rowEditButton(ID.hpi)));
    await lookAway(user);
    expect(useScribeRecommendationsStore.getState().itemState[ID.hpi].edited).toBeUndefined();
  });

  it('says so when the transcript yields nothing chartable', async () => {
    const user = userEvent.setup();
    mocks.plan.mockReturnValue({ actions: [], rejected: [], ...envelope });
    render(<ScribeRecommendationsDrawer />, { wrapper: Wrapper });
    await user.click(screen.getByTestId(testIds.openButton));
    await user.click(screen.getByTestId(testIds.useSampleButton));
    await user.click(screen.getByTestId(testIds.analyzeButton));

    expect(await screen.findByText(/couldn’t find anything chartable/)).toBeVisible();
    expect(screen.queryByTestId(testIds.chartButton)).toBeNull();
    expect(screen.queryByTestId(testIds.stage('observations'))).toBeNull();
  });

  it('remembers the panel width and open state across mounts, but not the transcript', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ScribeRecommendationsDrawer />, { wrapper: Wrapper });
    await user.click(screen.getByTestId(testIds.openButton));
    await user.click(screen.getByTestId(testIds.useSampleButton));

    const handle = screen.getByTestId(testIds.resizeHandle);
    handle.focus();
    await user.keyboard('{ArrowLeft}');
    expect(useScribeRecommendationsStore.getState().width).toBe(SCRIBE_PANEL_DEFAULT_WIDTH + 24);
    unmount();

    const persisted = JSON.parse(localStorage.getItem('ambient-scribe-recommendations-panel') ?? '{}');
    expect(persisted.state).toEqual({ isOpen: true, width: SCRIBE_PANEL_DEFAULT_WIDTH + 24 });
  });
});

describe('applyRecommendations', () => {
  const recommendations: ScribeRecommendation[] = [
    {
      id: 'ros-1',
      kind: 'ros',
      section: 'ros',
      baseKey: 'ros-ent-ear-pain',
      finding: RosFindingState.Denies,
      label: 'Ear pain',
      systemLabel: 'ENT',
    },
    {
      id: 'dx-2',
      kind: 'diagnosis',
      section: 'assessment',
      code: 'R42',
      display: 'Dizziness',
      transcriptTerm: 'dizzy',
    },
    {
      id: 'dx-1',
      kind: 'diagnosis',
      section: 'assessment',
      code: 'J01.90',
      display: 'Sinusitis',
      transcriptTerm: 'sinus',
      isPrimary: true,
    },
    { id: 'tpl', kind: 'template', section: 'template', templateName: 'Sinusitis' },
    { id: 'hpi', kind: 'hpi', section: 'hpi', text: 'HPI' },
    {
      id: 'rm',
      kind: 'action',
      section: 'assessment',
      label: 'Removing diagnosis: Viral URI',
      action: { kind: 'remove-diagnosis', display: 'Viral URI' },
    },
  ];

  /** A runner that settles each row from `applyOne`: nothing back is applied, an outcome is that outcome, a throw fails it. */
  const runnerFrom =
    (applyOne: (rec: ScribeRecommendation) => Promise<StepOutcome | void>): RecommendationRunner =>
    async (recs, report) => {
      for (const rec of recs) {
        report.start(rec.id);
        try {
          const outcome = await applyOne(rec);
          report.settle(rec.id, outcome ?? { status: 'applied' });
        } catch (error) {
          report.settle(rec.id, { status: 'failed', reason: errorMessage(error) });
        }
      }
    };

  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    useScribeRecommendationsStore.setState({
      phase: 'ready',
      recommendations,
      itemState: Object.fromEntries(recommendations.map((rec) => [rec.id, { selected: true, status: 'idle' }])),
    });
  });

  it('leaves the template out of the observations batch', () => {
    expect(pendingObservationIds()).toEqual(['ros-1', 'dx-2', 'dx-1', 'hpi', 'rm']);

    useScribeRecommendationsStore.getState().setSelected('hpi', false);
    useScribeRecommendationsStore.getState().setItemStatus('dx-2', 'applied');
    expect(pendingObservationIds()).toEqual(['ros-1', 'dx-1', 'rm']);
  });

  it('runs in a stable clinical order — template, removals, then the additions — and skips rows already applied', async () => {
    const seen: string[] = [];
    useScribeRecommendationsStore.getState().setItemStatus('dx-2', 'applied');

    const result = await applyRecommendations(
      ['tpl', ...pendingObservationIds()],
      runnerFrom(async (rec) => {
        seen.push(rec.id);
      })
    );

    expect(result).toEqual({ applied: 5, skipped: 0, failed: 0 });
    // the removal frees the primary before the add that takes it over
    expect(seen).toEqual(['tpl', 'rm', 'hpi', 'dx-1', 'ros-1']);
    const { itemState, isApplying } = useScribeRecommendationsStore.getState();
    expect(isApplying).toBe(false);
    expect(itemState['tpl'].status).toBe('applied');
  });

  it('records each verdict on its row, carries on with the rest, and still reconciles', async () => {
    const reconcile = vi.fn().mockRejectedValue(new Error('offline'));

    const result = await applyRecommendations(
      recommendations.map((rec) => rec.id),
      runnerFrom(async (rec) => {
        // Zambda calls reject with a plain object rather than an Error instance.
        if (rec.id === 'dx-1') throw { output: { message: 'Encounter is locked', code: 400 } };
        if (rec.id === 'ros-1') return { status: 'skipped', reason: 'already on the chart' };
        if (rec.id === 'hpi') throw new Error('');
        if (rec.id === 'dx-2') return { status: 'applied', note: 'charted as secondary', lowConfidence: true };
        return undefined;
      }),
      { reconcile }
    );

    expect(result).toEqual({ applied: 3, skipped: 1, failed: 2 });
    expect(reconcile).toHaveBeenCalledTimes(1);
    const { itemState } = useScribeRecommendationsStore.getState();
    // the server's own wording, and a human sentence where there was none
    expect(itemState['dx-1']).toMatchObject({ selected: true, status: 'error', error: 'Encounter is locked' });
    expect(itemState['hpi'].error).toBe('Something went wrong. Please try again.');
    // a skipped row says why and comes out of the batch on its own
    expect(itemState['ros-1']).toMatchObject({ selected: false, status: 'skipped', reason: 'already on the chart' });
    // an applied row keeps what the executor had to say about it
    expect(itemState['dx-2']).toMatchObject({ status: 'applied', note: 'charted as secondary', lowConfidence: true });
    expect(itemState['tpl']).toMatchObject({ status: 'applied' });
    expect(itemState['tpl'].note).toBeUndefined();
  });

  it('tells every row when the run itself breaks rather than leaving them spinning', async () => {
    const result = await applyRecommendations(pendingObservationIds(), async () => {
      throw new Error('The visit is still loading. Please try again.');
    });

    expect(result).toEqual({ applied: 0, skipped: 0, failed: 5 });
    const { itemState, isApplying } = useScribeRecommendationsStore.getState();
    expect(isApplying).toBe(false);
    pendingObservationIds().forEach((id) =>
      expect(itemState[id]).toMatchObject({ status: 'error', error: 'The visit is still loading. Please try again.' })
    );
  });

  it('settles a row the run never reported on as skipped', async () => {
    const result = await applyRecommendations(['hpi', 'ros-1'], async (recs, report) => {
      report.start(recs[0].id);
      report.settle(recs[0].id, { status: 'applied' });
    });
    expect(result).toEqual({ applied: 1, skipped: 1, failed: 0 });
    expect(useScribeRecommendationsStore.getState().itemState['ros-1']).toMatchObject({
      status: 'skipped',
      reason: 'The run ended before this was applied.',
    });
  });
});

describe('PickerDialog', () => {
  beforeEach(() => resetStore());

  it('asks the executor’s question, and answers it with the option picked or with nothing', async () => {
    const user = userEvent.setup();
    render(<PickerDialog />, { wrapper: Wrapper });
    expect(screen.queryByTestId(testIds.pickerDialog)).toBeNull();

    // The executor asks; the panel shows the options with what the transcript said.
    const request = {
      prompt: 'Which allergy did you mean?',
      query: 'penicillin',
      options: [
        { id: 'a1', display: 'Penicillin G', score: 1 },
        { id: 'a2', display: 'Penicillin V potassium', score: 0.9 },
      ],
    };
    const answer = useScribeRecommendationsStore.getState().askPick(request);
    expect(await screen.findByTestId(testIds.pickerDialog)).toHaveTextContent('Which allergy did you mean?');
    expect(screen.getByTestId(testIds.pickerDialog)).toHaveTextContent('The transcript said “penicillin”.');

    await user.click(screen.getByTestId(testIds.pickerOption('a2')));
    await expect(answer).resolves.toMatchObject({ id: 'a2', display: 'Penicillin V potassium' });
    await waitFor(() => expect(screen.queryByTestId(testIds.pickerDialog)).toBeNull());
    expect(useScribeRecommendationsStore.getState().pendingPick).toBeNull();

    // Skipping is an answer too: the step settles as skipped rather than hanging on the question.
    const skipped = useScribeRecommendationsStore.getState().askPick(request);
    await user.click(await screen.findByTestId(testIds.pickerSkip));
    await expect(skipped).resolves.toBeUndefined();
  });
});

describe('isAlreadyCharted', () => {
  const snapshot = buildChartSnapshot({
    chartData: {
      diagnosis: [{ code: 'J01.90', display: 'Acute sinusitis, unspecified', isPrimary: true }],
      allergies: [
        { name: 'Fentanyl', current: true },
        { name: 'Penicillin', current: false },
      ],
      medications: [
        { name: 'Ibuprofen', status: 'active', type: 'as-needed', intakeInfo: {} },
        { name: 'Amoxicillin', status: 'completed', type: 'scheduled', intakeInfo: {} },
      ],
    },
    rosObservations: {
      'ros-neuro-headache-reports': { field: 'ros-neuro-headache-reports', value: true },
      'ros-ent-ear-pain-denies': { field: 'ros-ent-ear-pain-denies', value: false },
    },
    historyOfPresentIllness: 'Patient reports having post-nasal drip and sinus pressure for 1 week.',
    vitals: undefined,
  });

  const charted = (rec: Partial<ScribeRecommendation>): boolean =>
    isAlreadyCharted(rec as ScribeRecommendation, snapshot);

  it('matches a diagnosis on its code', () => {
    expect(charted({ kind: 'diagnosis', code: 'J01.90' })).toBe(true);
    expect(charted({ kind: 'diagnosis', code: 'R42' })).toBe(false);
  });

  it('ignores case and spacing on names, and only counts live entries', () => {
    expect(charted({ kind: 'allergy', name: ' fentanyl ' })).toBe(true);
    // an inactive allergy is not charted for our purposes
    expect(charted({ kind: 'allergy', name: 'Penicillin' })).toBe(false);
    expect(charted({ kind: 'medication', name: 'IBUPROFEN' })).toBe(true);
    // a completed medication is history, not a current one
    expect(charted({ kind: 'medication', name: 'Amoxicillin' })).toBe(false);
  });

  it('matches a review-of-systems finding only on the side that was recorded', () => {
    expect(charted({ kind: 'ros', baseKey: 'ros-neuro-headache', finding: RosFindingState.Reports })).toBe(true);
    expect(charted({ kind: 'ros', baseKey: 'ros-neuro-headache', finding: RosFindingState.Denies })).toBe(false);
    // recorded as false is the same as not recorded
    expect(charted({ kind: 'ros', baseKey: 'ros-ent-ear-pain', finding: RosFindingState.Denies })).toBe(false);
  });

  it('matches HPI text already present in the note, and never claims a template or a generic action is charted', () => {
    expect(charted({ kind: 'hpi', text: 'post-nasal drip and sinus pressure for 1 week.' })).toBe(true);
    expect(charted({ kind: 'hpi', text: 'Patient denies fever.' })).toBe(false);
    // another field's paragraph is not the HPI, however similar the words
    expect(
      charted({ kind: 'hpi', field: 'medicalDecision', text: 'post-nasal drip and sinus pressure for 1 week.' })
    ).toBe(false);
    expect(charted({ kind: 'template', templateName: 'Sinusitis' })).toBe(false);
    // the executor judges its own duplicates as it runs
    expect(
      charted({ kind: 'action', label: 'Adding exam finding: Sinus tenderness', action: { kind: 'add-exam-finding' } })
    ).toBe(false);
  });

  it('treats any weight on the encounter as the weight suggestion being charted', () => {
    const withWeight = buildChartSnapshot({
      chartData: {},
      rosObservations: {},
      historyOfPresentIllness: undefined,
      vitals: { 'vital-weight': [{ field: 'vital-weight', value: 77 }] } as never,
    });
    expect(isAlreadyCharted({ kind: 'vital-weight', weightLbs: 170 } as ScribeRecommendation, withWeight)).toBe(true);
    expect(charted({ kind: 'vital-weight', weightLbs: 170 })).toBe(false);
  });
});
