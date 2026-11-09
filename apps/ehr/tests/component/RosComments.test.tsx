import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { enqueueSnackbar } from 'notistack';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeferredMutation, DeferredCall, fail, settle, settleAll } from './helpers/deferred-chart-data-mutations';

// ============================================================================
// MOCKS
// ============================================================================
//
// Only the chart-data mutations, the snackbar and the scribe AI marks are mocked; useRosObservations,
// the ROS store and the pending-fields store are the real ones.

const saveCalls: DeferredCall[] = [];
const deleteCalls: DeferredCall[] = [];

const saveChartData = createDeferredMutation(saveCalls);
const deleteChartData = createDeferredMutation(deleteCalls);

vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useSaveChartData: () => ({ mutateAsync: saveChartData, isPending: false }),
  useDeleteChartData: () => ({ mutateAsync: deleteChartData, isPending: false }),
}));

vi.mock('src/features/visits/shared/components/scribe-recommendations/aiAddedMarks', () => ({
  useAiAddedRecommendations: () => [],
  findAiAddedFor: () => undefined,
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

vi.mock('src/components/RoundedButton', () => ({
  RoundedButton: ({ children, onClick, disabled, loading, ...rest }: any) => (
    <button onClick={onClick} disabled={disabled || loading} {...rest}>
      {children}
    </button>
  ),
}));

import { ClearRosButton } from '../../src/features/visits/shared/components/ros-tab/ClearRosButton';
import { RosCommentField } from '../../src/features/visits/shared/components/ros-tab/RosCommentField';
import { RosReviewContainer } from '../../src/features/visits/shared/components/ros-tab/RosReviewContainer';
import { useRosObservations } from '../../src/features/visits/shared/hooks/useRosObservations';
import {
  resetPendingObservationFields,
  usePendingObservationFieldsStore,
} from '../../src/features/visits/shared/stores/appointment/pending-observation-fields.store';
import { resetRosObservationsStore } from '../../src/features/visits/shared/stores/appointment/reset-ros-observations';
import {
  getRosStoreGeneration,
  useRosObservationsStore,
} from '../../src/features/visits/shared/stores/appointment/ros-observations.store';

const FIELD = 'ros-constitutional-comment';
const LABEL = 'Constitutional comment';

const flush = (): Promise<void> => act(async () => {});
const pendingCounts = (): Record<string, number> => usePendingObservationFieldsStore.getState().counts;
const clearRosButton = (): HTMLElement => screen.getByRole('button', { name: 'Clear ROS' });

const resetState = (): void => {
  vi.clearAllMocks();
  saveCalls.length = 0;
  deleteCalls.length = 0;
  resetRosObservationsStore();
  resetPendingObservationFields();
};

beforeEach(resetState);

// The hook chains comment writes per field at module scope, so no request may be left hanging.
afterEach(async () => {
  for (let i = 0; i < 5 && (saveCalls.length || deleteCalls.length); i++) {
    await settleAll(saveCalls);
    await settleAll(deleteCalls);
    await flush();
  }
});

// ============================================================================
// TESTS
// ============================================================================

describe('useRosObservations.updateComment', () => {
  it('saves a new comment with its note and no value, then keeps the note and takes the resourceId', async () => {
    const { result } = renderHook(() => useRosObservations());

    act(() => result.current.updateComment(FIELD, LABEL, 'tired lately'));
    await flush();

    expect(saveChartData).toHaveBeenCalledTimes(1);
    expect(saveChartData).toHaveBeenCalledWith({
      rosObservations: [expect.objectContaining({ field: FIELD, label: LABEL, note: 'tired lately' })],
    });
    expect(saveCalls[0].variables.rosObservations).toHaveLength(1);
    expect(saveCalls[0].variables.rosObservations[0].value).toBeUndefined();

    await settle(saveCalls[0], {
      chartData: { rosObservations: [{ field: FIELD, label: LABEL, note: 'tired lately', resourceId: 'c-1' }] },
    });
    await flush();

    expect(deleteChartData).not.toHaveBeenCalled();
    expect(useRosObservationsStore.getState()[FIELD]).toEqual(
      expect.objectContaining({ field: FIELD, note: 'tired lately', resourceId: 'c-1' })
    );
    expect(pendingCounts()).toEqual({});
  });

  it('holds a second edit until the in-flight save returns, then sends it once with the resourceId', async () => {
    const { result } = renderHook(() => useRosObservations());

    act(() => result.current.updateComment(FIELD, LABEL, 'a'));
    await flush();
    expect(saveChartData).toHaveBeenCalledTimes(1);

    act(() => result.current.updateComment(FIELD, LABEL, 'ab'));
    await flush();
    expect(saveChartData).toHaveBeenCalledTimes(1);
    expect(useRosObservationsStore.getState()[FIELD].note).toBe('ab');
    expect(pendingCounts()[FIELD]).toBeGreaterThan(0);

    await settle(saveCalls[0], {
      chartData: { rosObservations: [{ field: FIELD, label: LABEL, note: 'a', resourceId: 'c-1' }] },
    });
    await flush();

    // The in-flight response must not overwrite the newer note.
    expect(saveChartData).toHaveBeenCalledTimes(2);
    expect(saveCalls[1].variables).toEqual({
      rosObservations: [expect.objectContaining({ field: FIELD, note: 'ab', resourceId: 'c-1' })],
    });

    await settle(saveCalls[1], {
      chartData: { rosObservations: [{ field: FIELD, label: LABEL, note: 'ab', resourceId: 'c-1' }] },
    });
    await flush();

    expect(saveChartData).toHaveBeenCalledTimes(2);
    expect(useRosObservationsStore.getState()[FIELD]).toEqual(
      expect.objectContaining({ note: 'ab', resourceId: 'c-1' })
    );
    expect(pendingCounts()).toEqual({});
  });

  it('skips superseded edits and writes only the latest note after the in-flight save', async () => {
    const { result } = renderHook(() => useRosObservations());

    act(() => result.current.updateComment(FIELD, LABEL, 'a'));
    await flush();
    act(() => result.current.updateComment(FIELD, LABEL, 'ab'));
    act(() => result.current.updateComment(FIELD, LABEL, 'abc'));
    await flush();
    expect(saveChartData).toHaveBeenCalledTimes(1);

    await settle(saveCalls[0], {
      chartData: { rosObservations: [{ field: FIELD, label: LABEL, note: 'a', resourceId: 'c-1' }] },
    });
    await flush();

    expect(saveChartData).toHaveBeenCalledTimes(2);
    expect(saveCalls[1].variables.rosObservations).toEqual([
      expect.objectContaining({ field: FIELD, note: 'abc', resourceId: 'c-1' }),
    ]);

    await settle(saveCalls[1], {
      chartData: { rosObservations: [{ field: FIELD, label: LABEL, note: 'abc', resourceId: 'c-1' }] },
    });
    await flush();

    expect(saveChartData).toHaveBeenCalledTimes(2);
    expect(useRosObservationsStore.getState()[FIELD].note).toBe('abc');
    expect(pendingCounts()).toEqual({});
  });

  it('deletes a saved comment that is emptied and drops its resourceId from the store', async () => {
    useRosObservationsStore.setState(
      { [FIELD]: { field: FIELD, label: LABEL, note: 'tired lately', resourceId: 'c-1' } },
      true
    );
    const { result } = renderHook(() => useRosObservations());

    act(() => result.current.updateComment(FIELD, LABEL, ''));
    await flush();

    expect(saveChartData).not.toHaveBeenCalled();
    expect(deleteChartData).toHaveBeenCalledTimes(1);
    expect(deleteChartData).toHaveBeenCalledWith({
      rosObservations: [expect.objectContaining({ field: FIELD, resourceId: 'c-1' })],
    });
    expect(useRosObservationsStore.getState()[FIELD].resourceId).toBeUndefined();
    expect(useRosObservationsStore.getState()[FIELD].note).toBe('');

    await settle(deleteCalls[0], {});
    await flush();
    expect(pendingCounts()).toEqual({});
  });

  it('survives a failed save, reports it, and releases the pending hold', async () => {
    const { result } = renderHook(() => useRosObservations());

    act(() => result.current.updateComment(FIELD, LABEL, 'tired lately'));
    await flush();
    expect(pendingCounts()[FIELD]).toBeGreaterThan(0);

    await fail(saveCalls[0]);
    await flush();

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.stringMatching(/error/i), { variant: 'error' });
    expect(pendingCounts()).toEqual({});
    expect(Object.values(useRosObservationsStore.getState()).every(Boolean)).toBe(true);

    // The chain is not stuck: a later edit still goes out.
    act(() => result.current.updateComment(FIELD, LABEL, 'tired'));
    await flush();
    expect(saveChartData).toHaveBeenCalledTimes(2);
  });
});

describe('useRosObservations comment races', () => {
  const hydrate = (result: { current: ReturnType<typeof useRosObservations> }, note: string): void =>
    act(() => result.current.update([{ field: FIELD, label: LABEL, note, resourceId: 'c-1' }], true));

  it('rolls a failed edit back to the comment the server holds', async () => {
    const { result } = renderHook(() => useRosObservations());
    hydrate(result, 'saved');

    act(() => result.current.updateComment(FIELD, LABEL, 'unsaved'));
    await flush();
    await fail(saveCalls[0]);
    await flush();

    expect(useRosObservationsStore.getState()[FIELD]).toEqual(
      expect.objectContaining({ note: 'saved', resourceId: 'c-1' })
    );
  });

  it('keeps an edited comment when a stale server copy is hydrated mid-save, and still sends the latest edit', async () => {
    const { result } = renderHook(() => useRosObservations());
    hydrate(result, 'ab');

    act(() => result.current.updateComment(FIELD, LABEL, 'abc'));
    await flush();
    act(() => result.current.updateComment(FIELD, LABEL, 'abcd'));
    hydrate(result, 'ab');

    expect(useRosObservationsStore.getState()[FIELD].note).toBe('abcd');

    await settle(saveCalls[0], {
      chartData: { rosObservations: [{ field: FIELD, label: LABEL, note: 'abc', resourceId: 'c-1' }] },
    });
    await flush();

    expect(saveChartData).toHaveBeenCalledTimes(2);
    expect(saveCalls[1].variables).toEqual({
      rosObservations: [expect.objectContaining({ field: FIELD, note: 'abcd', resourceId: 'c-1' })],
    });
  });

  it('does not merge a save that returns after the store was reset', async () => {
    const { result } = renderHook(() => useRosObservations());

    act(() => result.current.updateComment(FIELD, LABEL, 'from the previous chart'));
    await flush();
    act(() => resetRosObservationsStore());

    await settle(saveCalls[0], {
      chartData: {
        rosObservations: [{ field: FIELD, label: LABEL, note: 'from the previous chart', resourceId: 'c-1' }],
      },
    });
    await flush();

    expect(useRosObservationsStore.getState()[FIELD]).toBeUndefined();
    expect(deleteChartData).not.toHaveBeenCalled();
  });

  it('drops an edit made before the store was reset', async () => {
    const { result } = renderHook(() => useRosObservations());
    const generation = getRosStoreGeneration();

    act(() => resetRosObservationsStore());
    act(() => result.current.updateComment(FIELD, LABEL, 'stale', generation));
    await flush();

    expect(saveChartData).not.toHaveBeenCalled();
    expect(useRosObservationsStore.getState()[FIELD]).toBeUndefined();
  });
});

describe('RosCommentField', () => {
  it('saves right away on blur instead of waiting for the debounce', async () => {
    const user = userEvent.setup({ delay: null });
    render(<RosCommentField systemKey="constitutional" systemLabel="Constitutional" />);

    await user.type(screen.getByRole('textbox'), 'tired');
    expect(saveChartData).not.toHaveBeenCalled();

    await user.tab();
    await flush();

    expect(saveChartData).toHaveBeenCalledWith({
      rosObservations: [expect.objectContaining({ field: FIELD, note: 'tired' })],
    });
  });

  it('drops a queued edit when the field unmounts because the store was reset', async () => {
    const user = userEvent.setup({ delay: null });
    const { unmount } = render(<RosCommentField systemKey="constitutional" systemLabel="Constitutional" />);

    await user.type(screen.getByRole('textbox'), 'tired');
    act(() => resetRosObservationsStore());
    unmount();
    await flush();

    expect(saveChartData).not.toHaveBeenCalled();
    expect(pendingCounts()).toEqual({});
  });
});

describe('RosCommentField whitespace and server sync', () => {
  const renderField = (): HTMLElement => {
    render(<RosCommentField systemKey="constitutional" systemLabel="Constitutional" />);
    return screen.getByRole('textbox');
  };
  const saveReturns = async (index: number, note: string): Promise<void> => {
    await settle(saveCalls[index], {
      chartData: { rosObservations: [{ field: FIELD, label: LABEL, note, resourceId: 'c-1' }] },
    });
    await flush();
  };

  it('keeps a trailing space after its trimmed save returns, and keeps typing after it', async () => {
    const user = userEvent.setup({ delay: null });
    const input = renderField();

    await user.type(input, 'chest pain ');
    await waitFor(() => expect(saveChartData).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(saveCalls[0].variables.rosObservations[0].note).toBe('chest pain');
    await saveReturns(0, 'chest pain');

    expect(input).toHaveValue('chest pain ');

    await user.type(input, 'x');
    expect(input).toHaveValue('chest pain x');
    await waitFor(() => expect(saveChartData).toHaveBeenCalledTimes(2), { timeout: 5000 });
    expect(saveCalls[1].variables.rosObservations[0].note).toBe('chest pain x');
  });

  it('keeps a trailing space typed while the save is in flight', async () => {
    const user = userEvent.setup({ delay: null });
    const input = renderField();

    await user.type(input, 'chest pain');
    await waitFor(() => expect(saveChartData).toHaveBeenCalledTimes(1), { timeout: 5000 });

    await user.type(input, ' ');
    await saveReturns(0, 'chest pain');

    expect(input).toHaveValue('chest pain ');
    await user.type(input, 'x');
    expect(input).toHaveValue('chest pain x');
  });

  it('keeps trailing and leading whitespace and newlines on blur', async () => {
    const user = userEvent.setup({ delay: null });
    const input = renderField();

    await user.type(input, '  fever{Enter}');
    await user.tab();
    await flush();
    expect(saveCalls[0].variables.rosObservations[0].note).toBe('fever');
    await saveReturns(0, 'fever');

    expect(input).toHaveValue('  fever\n');
  });

  it('does not let a stale server copy overwrite text being typed', async () => {
    const user = userEvent.setup({ delay: null });
    const { result } = renderHook(() => useRosObservations());
    const input = renderField();

    await user.type(input, 'chest');
    await waitFor(() => expect(saveChartData).toHaveBeenCalledTimes(1), { timeout: 5000 });
    await user.type(input, ' pain ');
    act(() => result.current.update([{ field: FIELD, label: LABEL, note: 'old', resourceId: 'c-1' }], true));

    expect(input).toHaveValue('chest pain ');
  });

  it('applies a stored value that changed elsewhere while the box is untouched', async () => {
    const { result } = renderHook(() => useRosObservations());
    const input = renderField();

    act(() => result.current.update([{ field: FIELD, label: LABEL, note: 'from template', resourceId: 'c-1' }], true));

    expect(input).toHaveValue('from template');
  });
});

describe('RosCommentField with ClearRosButton', () => {
  it('disables Clear ROS from the keystroke on and re-enables it once the requests settle', async () => {
    useRosObservationsStore.setState(
      {
        'ros-constitutional-fever-denies': {
          field: 'ros-constitutional-fever-denies',
          label: 'Fever',
          value: true,
          resourceId: 'obs-fever',
        },
      },
      true
    );
    const user = userEvent.setup({ delay: null });
    render(
      <>
        <ClearRosButton />
        <RosCommentField systemKey="constitutional" systemLabel="Constitutional" />
      </>
    );

    expect(clearRosButton()).toBeEnabled();

    await user.type(screen.getByRole('textbox'), 'tired lately');

    expect(saveChartData).not.toHaveBeenCalled();
    expect(clearRosButton()).toBeDisabled();

    await waitFor(() => expect(saveChartData).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(saveCalls[0].variables).toEqual({
      rosObservations: [expect.objectContaining({ field: FIELD, label: LABEL, note: 'tired lately' })],
    });
    expect(clearRosButton()).toBeDisabled();

    await settle(saveCalls[0], {
      chartData: { rosObservations: [{ field: FIELD, label: LABEL, note: 'tired lately', resourceId: 'c-1' }] },
    });
    await flush();

    await waitFor(() => expect(clearRosButton()).toBeEnabled());
    expect(pendingCounts()).toEqual({});
  });

  it('enables Clear ROS for a comment-only ROS and deletes the comment once confirmed', async () => {
    useRosObservationsStore.setState(
      { [FIELD]: { field: FIELD, label: LABEL, note: 'tired lately', resourceId: 'c-1' } },
      true
    );
    const user = userEvent.setup();
    render(<ClearRosButton />);

    expect(clearRosButton()).toBeEnabled();

    await user.click(clearRosButton());
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear ROS' }));

    await waitFor(() =>
      expect(deleteChartData).toHaveBeenCalledWith({
        rosObservations: [expect.objectContaining({ field: FIELD, resourceId: 'c-1' })],
      })
    );
    expect(saveChartData).not.toHaveBeenCalled();
    expect(useRosObservationsStore.getState()[FIELD].note).toBe('');
    expect(useRosObservationsStore.getState()[FIELD].resourceId).toBeUndefined();
  });
});

describe('RosReviewContainer', () => {
  it('renders the comment below the findings of a system', () => {
    useRosObservationsStore.setState(
      {
        'ros-constitutional-fever-denies': { field: 'ros-constitutional-fever-denies', label: 'Fever', value: true },
        [FIELD]: { field: FIELD, label: LABEL, note: 'tired lately' },
      },
      true
    );

    render(<RosReviewContainer />);

    expect(screen.getByText('Constitutional')).toBeInTheDocument();
    expect(screen.getByText(/Fever/)).toBeInTheDocument();
    expect(screen.getByText('tired lately')).toBeInTheDocument();
    expect(screen.queryByText('No review of systems')).not.toBeInTheDocument();
  });

  it('renders a system that has only a comment', () => {
    useRosObservationsStore.setState({ [FIELD]: { field: FIELD, label: LABEL, note: '  tired lately  ' } }, true);

    render(<RosReviewContainer />);

    expect(screen.getByText('Constitutional')).toBeInTheDocument();
    expect(screen.getByText('tired lately')).toBeInTheDocument();
    expect(screen.queryByText('No review of systems')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no findings and no comments', () => {
    useRosObservationsStore.setState(
      {
        'ros-constitutional-fever-denies': { field: 'ros-constitutional-fever-denies', label: 'Fever', value: false },
        [FIELD]: { field: FIELD, label: LABEL, note: '   ' },
      },
      true
    );

    render(<RosReviewContainer />);

    expect(screen.getByText('No review of systems')).toBeInTheDocument();
    expect(screen.queryByText('Constitutional')).not.toBeInTheDocument();
  });
});
