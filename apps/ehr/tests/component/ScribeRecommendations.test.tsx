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
  const { applySelectedRecommendations } = await import(
    '../../src/features/visits/shared/components/scribe-recommendations/applySelectedRecommendations'
  );
  return {
    useApplyRecommendations: () => ({
      applySelected: () => applySelectedRecommendations(mocks.applyOne),
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
import { applySelectedRecommendations } from '../../src/features/visits/shared/components/scribe-recommendations/applySelectedRecommendations';
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
  await screen.findByTestId(testIds.applyButton);
};

const rowCheckbox = (id: string): HTMLInputElement =>
  within(screen.getByTestId(testIds.rowCheckbox(id))).getByRole('checkbox') as HTMLInputElement;

const appliedKinds = (): string[] => mocks.applyOne.mock.calls.map(([rec]) => (rec as ScribeRecommendation).kind);
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

  it('shows every recommendation checked by default, grouped by section, with the orders unchecked', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);

    const { recommendations, orderSuggestions } = useScribeRecommendationsStore.getState();
    expect(recommendations.length).toBeGreaterThan(0);
    recommendations.forEach((rec) => expect(rowCheckbox(rec.id)).toBeChecked());
    expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent(
      `${recommendations.length} of ${recommendations.length} selected`
    );

    // the groups the transcript feeds, each with a way into that part of the note
    ['template', 'hpi', 'assessment', 'ros', 'vitals', 'allergies', 'medications'].forEach((section) => {
      expect(screen.getByTestId(testIds.group(section))).toBeVisible();
      expect(screen.getByTestId(testIds.goToSectionButton(section))).toBeVisible();
    });
    expect(screen.getByText('Acute sinusitis, unspecified (J01.90)')).toBeVisible();
    expect(screen.getByText('Ears/Nose/Throat: Post-nasal drip')).toBeVisible();

    // suggested orders are a manual checklist
    expect(screen.getByText('You may wish to give one or both of:')).toBeVisible();
    expect(orderSuggestions.map((order) => order.name)).toEqual(['Dexamethasone', 'Guaifenesin']);
    orderSuggestions.forEach((order) => {
      expect(within(screen.getByTestId(testIds.orderCheckbox(order.id))).getByRole('checkbox')).not.toBeChecked();
    });

    await user.click(screen.getByTestId(testIds.goToSectionButton('ros')));
    expect(mocks.navigate).toHaveBeenCalledWith('/in-person/appointment-1/review-of-systems');

    await user.click(screen.getByTestId(testIds.orderButton('order-dexamethasone')));
    expect(mocks.navigate).toHaveBeenCalledWith('/in-person/appointment-1/in-house-medication/order/new');
  });

  it('applies only the checked recommendations, template first, and leaves orders alone', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);
    const total = useScribeRecommendationsStore.getState().recommendations.length;

    await user.click(rowCheckbox('medication-claritin'));
    expect(rowCheckbox('medication-claritin')).not.toBeChecked();
    expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent(`${total - 1} of ${total} selected`);
    // partially selected group
    expect(within(screen.getByTestId(testIds.groupCheckbox('medications'))).getByRole('checkbox')).toHaveAttribute(
      'data-indeterminate',
      'true'
    );

    await user.click(screen.getByTestId(testIds.applyButton));
    await waitFor(() => expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent(`${total - 1} applied`));

    expect(mocks.applyOne).toHaveBeenCalledTimes(total - 1);
    expect(appliedIds()).not.toContain('medication-claritin');
    expect(appliedIds()).not.toContain('order-dexamethasone');
    expect(appliedKinds()[0]).toBe('template');
    // the preferred primary is written before the other diagnoses
    const diagnosisIds = appliedIds().filter((id) => id.startsWith('dx-'));
    expect(diagnosisIds[0]).toBe('dx-acute-sinusitis');

    expect(screen.getByTestId(testIds.rowStatus('hpi-summary'))).toHaveAttribute('aria-label', 'Applied');
    expect(screen.queryByTestId(testIds.rowStatus('medication-claritin'))).toBeNull();
    expect(rowCheckbox('medication-claritin')).not.toBeChecked();
    expect(rowCheckbox('medication-claritin')).toBeEnabled();
    // applied rows are settled
    expect(rowCheckbox('hpi-summary')).toBeDisabled();
    expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent('0 of 1 selected');
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

    await user.click(screen.getByTestId(testIds.applyButton));
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

  it('keeps failed rows unapplied with a retry, and lets a group be toggled as a whole', async () => {
    const user = userEvent.setup();
    mocks.applyOne.mockImplementation(async (rec) => {
      if ((rec as ScribeRecommendation).kind === 'template') throw new Error('Template not available here');
    });
    await openPanelWithRecommendations(user);
    const total = useScribeRecommendationsStore.getState().recommendations.length;

    // uncheck all of ROS in one go
    await user.click(within(screen.getByTestId(testIds.groupCheckbox('ros'))).getByRole('checkbox'));
    const rosIds = useScribeRecommendationsStore
      .getState()
      .recommendations.filter((rec) => rec.section === 'ros')
      .map((rec) => rec.id);
    rosIds.forEach((id) => expect(rowCheckbox(id)).not.toBeChecked());

    await user.click(screen.getByTestId(testIds.applyButton));
    await waitFor(() =>
      expect(screen.getByTestId(testIds.rowStatus('template-acute-sinusitis'))).toHaveAttribute('aria-label', 'Failed')
    );
    expect(screen.getByText('Template not available here')).toBeVisible();
    expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent(`${total - rosIds.length - 1} applied`);
    expect(screen.getByTestId(testIds.selectionSummary)).toHaveTextContent('1 failed');
    expect(appliedIds()).not.toEqual(expect.arrayContaining(rosIds));

    // retry re-runs just what is still selected: the failed template
    mocks.applyOne.mockResolvedValue(undefined);
    mocks.applyOne.mockClear();
    await user.click(screen.getByTestId(testIds.rowRetryButton('template-acute-sinusitis')));
    await waitFor(() =>
      expect(screen.getByTestId(testIds.rowStatus('template-acute-sinusitis'))).toHaveAttribute('aria-label', 'Applied')
    );
    expect(appliedIds()).toEqual(['template-acute-sinusitis']);
  });

  it('tracks suggested orders as a manual checklist', async () => {
    const user = userEvent.setup();
    await openPanelWithRecommendations(user);

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

describe('applySelectedRecommendations', () => {
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

  it('writes in a stable clinical order and skips deselected or already applied rows', async () => {
    const applyOne = vi.fn().mockResolvedValue(undefined);
    useScribeRecommendationsStore.getState().setSelected('hpi', false);
    useScribeRecommendationsStore.getState().setItemStatus('dx-2', 'applied');

    const result = await applySelectedRecommendations(applyOne);

    expect(result).toEqual({ applied: 3, failed: 0 });
    expect(applyOne.mock.calls.map(([rec]) => rec.id)).toEqual(['tpl', 'dx-1', 'ros-1']);
    const { itemState, isApplying } = useScribeRecommendationsStore.getState();
    expect(isApplying).toBe(false);
    expect(itemState['tpl'].status).toBe('applied');
    expect(itemState['hpi'].status).toBe('idle');
  });

  it('records a failure on the row, carries on with the rest, and still reconciles', async () => {
    const applyOne = vi.fn(async (rec: ScribeRecommendation) => {
      if (rec.id === 'dx-1') throw new Error('Duplicate code');
    });
    const reconcile = vi.fn().mockRejectedValue(new Error('offline'));

    const result = await applySelectedRecommendations(applyOne, { reconcile });

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
      if (rec.kind === 'template')
        useScribeRecommendationsStore.getState().updateRecommendation('hpi', { text: 'Edited' });
    });

    await applySelectedRecommendations(applyOne);

    expect(seen).toEqual(['Edited']);
  });
});
