import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

const mocks = vi.hoisted(() => ({
  applyOne: vi.fn(async (_recommendation: unknown): Promise<void> => undefined),
  enqueueSnackbar: vi.fn(),
  navigate: vi.fn(),
}));

// The fake model waits a bit to feel like a request; the tests don't need to.
vi.mock(
  '../../src/features/visits/shared/components/scribe-recommendations/fakeScribeAnalysis',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../src/features/visits/shared/components/scribe-recommendations/fakeScribeAnalysis')
      >();
    return {
      ...actual,
      analyzeTranscript: (transcript: string) => actual.analyzeTranscript(transcript, { delayMs: 0 }),
    };
  }
);

// Keep the real orchestration (selection, ordering, statuses); stub only the chart writes.
vi.mock('../../src/features/visits/shared/components/scribe-recommendations/useApplyRecommendations', async () => {
  const { applyRecommendations, pendingObservationIds } = await import(
    '../../src/features/visits/shared/components/scribe-recommendations/applyRecommendations'
  );
  return {
    useApplyRecommendations: () => ({
      applyObservations: () => applyRecommendations(pendingObservationIds(), mocks.applyOne),
      applyRecommendation: (id: string) => applyRecommendations([id], mocks.applyOne),
    }),
  };
});

vi.mock('../../src/features/visits/shared/components/templates/useListTemplates', () => ({
  useListTemplates: () => ({
    templates: [
      { id: 't-1', value: 'Acute Sinusitis Unspecified', label: 'Acute Sinusitis Unspecified', isCurrentVersion: true },
      { id: 't-2', value: 'Sinusitis', label: 'Sinusitis', isCurrentVersion: true },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ encounter: { id: 'encounter-1' } }),
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
  pendingObservationIds,
} from '../../src/features/visits/shared/components/scribe-recommendations/applyRecommendations';
import {
  SCRIBE_PANEL_DEFAULT_WIDTH,
  useScribeRecommendationsStore,
} from '../../src/features/visits/shared/components/scribe-recommendations/scribeRecommendations.store';
import { ScribeRecommendationsDrawer } from '../../src/features/visits/shared/components/scribe-recommendations/ScribeRecommendationsDrawer';
import { ScribeRecommendation } from '../../src/features/visits/shared/components/scribe-recommendations/types';

// ============================================================================
// HELPERS
// ============================================================================

const testIds = dataTestIds.scribeRecommendations;
const TEMPLATE_ID = 'template-acute-sinusitis';

const Wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <MemoryRouter initialEntries={['/in-person/appointment-1/review-and-sign']}>{children}</MemoryRouter>
);

const resetStore = (): void => {
  useScribeRecommendationsStore.setState({
    isOpen: false,
    width: SCRIBE_PANEL_DEFAULT_WIDTH,
    encounterId: undefined,
    transcript: '',
    phase: 'input',
    analysisError: undefined,
    recommendations: [],
    itemState: {},
    orderSuggestions: [],
    ordersDone: {},
    isApplying: false,
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

  it('lays the results out as three numbered stages', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);

    const template = screen.getByTestId(testIds.stage('template'));
    const observationsStage = screen.getByTestId(testIds.stage('observations'));
    const orders = screen.getByTestId(testIds.stage('orders'));

    expect(within(template).getByText('1')).toBeVisible();
    expect(within(template).getByText(/template that looks like a good fit/)).toBeVisible();
    expect(within(observationsStage).getByText('2')).toBeVisible();
    expect(within(observationsStage).getByText(/observations, which I read in the transcript/)).toBeVisible();
    expect(within(orders).getByText('3')).toBeVisible();
    expect(within(orders).getByText(/orders you might want to make/)).toBeVisible();

    // stage one is a single named template with its own button, not a row in the list below
    expect(within(template).getByText('Acute Sinusitis Unspecified')).toBeVisible();
    expect(within(template).getByTestId(testIds.templateApplyButton)).toBeEnabled();
    expect(screen.queryByTestId(testIds.rowCheckbox(TEMPLATE_ID))).toBeNull();
    expect(screen.queryByTestId(testIds.group('template'))).toBeNull();

    // stage two holds every observation, checked, grouped by the section it writes into
    observations().forEach((rec) => expect(rowCheckbox(rec.id)).toBeChecked());
    ['hpi', 'assessment', 'ros', 'vitals', 'allergies', 'medications'].forEach((section) => {
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
    expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent(
      `${observations().length} of ${observations().length} selected`
    );
    expect(screen.getByTestId(testIds.applyObservationsButton)).toHaveTextContent(
      `Add ${observations().length} observations`
    );

    // stage three is a to-do list, so nothing in it starts ticked
    useScribeRecommendationsStore.getState().orderSuggestions.forEach((order) => {
      expect(within(screen.getByTestId(testIds.orderCheckbox(order.id))).getByRole('checkbox')).not.toBeChecked();
    });

    await user.click(within(observationsStage).getByTestId(testIds.goToSectionButton('ros')));
    expect(mocks.navigate).toHaveBeenCalledWith('/in-person/appointment-1/review-of-systems');

    await user.click(within(orders).getByTestId(testIds.orderButton('order-dexamethasone')));
    expect(mocks.navigate).toHaveBeenCalledWith('/in-person/appointment-1/in-house-medication/order/new');
  });

  it('applies the template on its own, leaving the observations untouched', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);

    await user.click(screen.getByTestId(testIds.templateApplyButton));
    await waitFor(() => expect(screen.queryByTestId(testIds.templateApplyButton)).toBeNull());

    expect(appliedIds()).toEqual([TEMPLATE_ID]);
    expect(screen.getByTestId(testIds.rowStatus(TEMPLATE_ID))).toHaveTextContent('Template applied');
    // the observations are still waiting on their own button
    observations().forEach((rec) => expect(rowCheckbox(rec.id)).toBeChecked());
    expect(screen.getByTestId(testIds.applyObservationsButton)).toBeEnabled();
  });

  it('adds only the checked observations, and never the template or the orders', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);
    const total = observations().length;

    await user.click(rowCheckbox('medication-claritin'));
    expect(rowCheckbox('medication-claritin')).not.toBeChecked();
    expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent(`${total - 1} of ${total} selected`);

    await user.click(screen.getByTestId(testIds.applyObservationsButton));
    await waitFor(() => expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent(`${total - 1} added`));

    expect(mocks.applyOne).toHaveBeenCalledTimes(total - 1);
    expect(appliedIds()).not.toContain('medication-claritin');
    expect(appliedIds()).not.toContain(TEMPLATE_ID);
    expect(appliedIds()).not.toContain('order-dexamethasone');
    // the preferred primary is written before the other diagnoses
    expect(appliedIds().filter((id) => id.startsWith('dx-'))[0]).toBe('dx-acute-sinusitis');

    expect(screen.getByTestId(testIds.rowStatus('hpi-summary'))).toHaveAttribute('aria-label', 'Applied');
    expect(screen.queryByTestId(testIds.rowStatus('medication-claritin'))).toBeNull();
    expect(rowCheckbox('medication-claritin')).toBeEnabled();
    // applied rows are settled
    expect(rowCheckbox('hpi-summary')).toBeDisabled();
    expect(screen.getByTestId(testIds.templateApplyButton)).toBeEnabled();
  });

  it('applies the edited version of a recommendation', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);

    await user.click(screen.getByTestId(testIds.rowEditButton('hpi-summary')));
    const input = screen.getByTestId(testIds.rowEditInput('hpi-summary'));
    await user.clear(input);
    await user.type(input, 'Post-nasal drip and sinus pressure x 1 week, worse in the afternoons.');
    await user.click(screen.getByTestId(testIds.rowEditSaveButton('hpi-summary')));
    expect(screen.getByText('Post-nasal drip and sinus pressure x 1 week, worse in the afternoons.')).toBeVisible();

    await user.click(screen.getByTestId(testIds.rowEditButton('vital-weight')));
    const weightInput = screen.getByTestId(testIds.rowEditInput('vital-weight'));
    await user.clear(weightInput);
    await user.type(weightInput, '172');
    await user.click(screen.getByTestId(testIds.rowEditSaveButton('vital-weight')));
    expect(screen.getByText(/Weight 172 lbs/)).toBeVisible();

    await user.click(screen.getByTestId(testIds.rowEditButton('dx-postnasal-drip')));
    await user.click(screen.getByTestId('pick-diagnosis'));
    await user.click(screen.getByTestId(testIds.rowEditSaveButton('dx-postnasal-drip')));
    expect(screen.getByText('Acute maxillary sinusitis (J01.00)')).toBeVisible();

    await user.click(screen.getByTestId(testIds.applyObservationsButton));
    await waitFor(() =>
      expect(screen.getByTestId(testIds.rowStatus('vital-weight'))).toHaveAttribute('aria-label', 'Applied')
    );

    const applied = mocks.applyOne.mock.calls.map(([rec]) => rec as ScribeRecommendation);
    expect(applied.find((rec) => rec.id === 'hpi-summary')).toMatchObject({
      text: 'Post-nasal drip and sinus pressure x 1 week, worse in the afternoons.',
    });
    expect(applied.find((rec) => rec.id === 'vital-weight')).toMatchObject({ weightLbs: 172 });
    expect(applied.find((rec) => rec.id === 'dx-postnasal-drip')).toMatchObject({ code: 'J01.00' });
  });

  it('lets a failed template be swapped for another and applied again', async () => {
    const user = userEvent.setup();
    mocks.applyOne.mockImplementation(async (rec) => {
      if ((rec as ScribeRecommendation).kind === 'template') throw new Error('Template not available here');
    });
    await openPanelWithRecommendations(user);

    await user.click(screen.getByTestId(testIds.templateApplyButton));
    await waitFor(() => expect(screen.getByText('Template not available here')).toBeVisible());
    expect(screen.getByTestId(testIds.templateApplyButton)).toHaveTextContent('Try again');

    // swap in a template this environment actually has
    await user.click(screen.getByTestId(testIds.rowEditButton(TEMPLATE_ID)));
    await user.click(screen.getByTestId(testIds.rowEditInput(TEMPLATE_ID)));
    await user.click(screen.getByRole('option', { name: /^Sinusitis$/ }));
    await user.click(screen.getByTestId(testIds.rowEditSaveButton(TEMPLATE_ID)));
    expect(screen.getByText('Sinusitis')).toBeVisible();

    mocks.applyOne.mockResolvedValue(undefined);
    await user.click(screen.getByTestId(testIds.templateApplyButton));
    await waitFor(() =>
      expect(screen.getByTestId(testIds.rowStatus(TEMPLATE_ID))).toHaveTextContent('Template applied')
    );
  });

  it('keeps failed observations unapplied with a retry, and skips whatever was unchecked', async () => {
    const user = userEvent.setup();
    mocks.applyOne.mockImplementation(async (rec) => {
      if ((rec as ScribeRecommendation).id === 'allergy-fentanyl') throw new Error('Allergen service is down');
    });
    await openPanelWithRecommendations(user);
    const total = observations().length;

    const rosIds = observations()
      .filter((rec) => rec.section === 'ros')
      .map((rec) => rec.id);
    for (const id of rosIds) {
      await user.click(rowCheckbox(id));
    }
    rosIds.forEach((id) => expect(rowCheckbox(id)).not.toBeChecked());

    await user.click(screen.getByTestId(testIds.applyObservationsButton));
    await waitFor(() =>
      expect(screen.getByTestId(testIds.rowStatus('allergy-fentanyl'))).toHaveAttribute('aria-label', 'Failed')
    );
    expect(screen.getByText('Allergen service is down')).toBeVisible();
    expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent(`${total - rosIds.length - 1} added`);
    expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent('1 failed');
    expect(appliedIds()).not.toEqual(expect.arrayContaining(rosIds));

    // retry re-runs just what is still selected: the failed allergy
    mocks.applyOne.mockResolvedValue(undefined);
    mocks.applyOne.mockClear();
    await user.click(screen.getByTestId(testIds.rowRetryButton('allergy-fentanyl')));
    await waitFor(() =>
      expect(screen.getByTestId(testIds.rowStatus('allergy-fentanyl'))).toHaveAttribute('aria-label', 'Applied')
    );
    expect(appliedIds()).toEqual(['allergy-fentanyl']);
  });

  it('keeps the transcript evidence out of the row until it is asked for', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);

    const quote = "I'm about 170 pounds.";
    const caution = 'Patient-reported, not measured.';
    expect(screen.queryByText(quote)).toBeNull();
    expect(screen.queryByText(caution)).toBeNull();
    expect(screen.queryByTestId(testIds.rowDetail('vital-weight'))).toBeNull();

    // hovering reads it without committing to anything
    await user.hover(screen.getByTestId(testIds.rowDetailButton('vital-weight')));
    expect(await screen.findByRole('tooltip')).toHaveTextContent(quote);

    // clicking pins it open, then closes it again
    await user.click(screen.getByTestId(testIds.rowDetailButton('vital-weight')));
    const detail = screen.getByTestId(testIds.rowDetail('vital-weight'));
    expect(within(detail).getByText(quote)).toBeVisible();
    expect(within(detail).getByText(caution)).toBeVisible();

    await user.click(screen.getByTestId(testIds.rowDetailButton('vital-weight')));
    await waitFor(() => expect(screen.queryByTestId(testIds.rowDetail('vital-weight'))).toBeNull());

    // rows the AI is confident about get the same affordance, unflagged
    expect(screen.getByTestId(testIds.rowDetailButton('dx-acute-sinusitis'))).toBeVisible();
  });

  it('tracks suggested orders as a manual checklist, with their rationale on demand', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);

    const rationale = 'Thins secretions to relieve the post-nasal drip and sinus congestion.';
    expect(screen.queryByText(rationale)).toBeNull();
    await user.click(screen.getByTestId(testIds.orderDetailButton('order-guaifenesin')));
    expect(within(screen.getByTestId(testIds.orderDetail('order-guaifenesin'))).getByText(rationale)).toBeVisible();

    const checkbox = within(screen.getByTestId(testIds.orderCheckbox('order-guaifenesin'))).getByRole('checkbox');
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(screen.getByTestId(testIds.orderButton('order-guaifenesin'))).toBeDisabled();
    expect(mocks.applyOne).not.toHaveBeenCalled();
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
  ];

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
    expect(pendingObservationIds()).toEqual(['ros-1', 'dx-2', 'dx-1', 'hpi']);

    useScribeRecommendationsStore.getState().setSelected('hpi', false);
    useScribeRecommendationsStore.getState().setItemStatus('dx-2', 'applied');
    expect(pendingObservationIds()).toEqual(['ros-1', 'dx-1']);
  });

  it('writes in a stable clinical order and skips rows that are already applied', async () => {
    const applyOne = vi.fn().mockResolvedValue(undefined);
    useScribeRecommendationsStore.getState().setItemStatus('dx-2', 'applied');

    const result = await applyRecommendations(['tpl', ...pendingObservationIds()], applyOne);

    expect(result).toEqual({ applied: 4, failed: 0 });
    expect(applyOne.mock.calls.map(([rec]) => rec.id)).toEqual(['tpl', 'hpi', 'dx-1', 'ros-1']);
    const { itemState, isApplying } = useScribeRecommendationsStore.getState();
    expect(isApplying).toBe(false);
    expect(itemState['tpl'].status).toBe('applied');
  });

  it('records a failure on the row, carries on with the rest, and still reconciles', async () => {
    const applyOne = vi.fn(async (rec: ScribeRecommendation) => {
      if (rec.id === 'dx-1') throw new Error('Duplicate code');
    });
    const reconcile = vi.fn().mockRejectedValue(new Error('offline'));

    const result = await applyRecommendations(
      recommendations.map((rec) => rec.id),
      applyOne,
      { reconcile }
    );

    expect(result).toEqual({ applied: 4, failed: 1 });
    expect(reconcile).toHaveBeenCalledTimes(1);
    const { itemState } = useScribeRecommendationsStore.getState();
    expect(itemState['dx-1']).toEqual({ selected: true, status: 'error', error: 'Duplicate code' });
    expect(itemState['dx-2'].status).toBe('applied');
  });

  it('uses the latest edit of a row rather than the copy from when apply started', async () => {
    const seen: string[] = [];
    const applyOne = vi.fn(async (rec: ScribeRecommendation) => {
      if (rec.kind === 'hpi') seen.push(rec.text);
      if (rec.kind === 'template') {
        useScribeRecommendationsStore.getState().updateRecommendation('hpi', { text: 'Edited' });
      }
    });

    await applyRecommendations(
      recommendations.map((rec) => rec.id),
      applyOne
    );

    expect(seen).toEqual(['Edited']);
  });
});
