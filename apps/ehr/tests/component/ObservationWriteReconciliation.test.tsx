import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeferredMutation, DeferredCall, fail, settle } from './helpers/deferred-chart-data-mutations';

// ============================================================================
// MOCKS
// ============================================================================
//
// Only the chart-data mutations and the snackbar are mocked; the hooks, the observation stores and
// the pending-fields store are the real ones. Each mutation call is captured as a deferred so a
// test can decide what the user does while the request is still in flight.

const saveCalls: DeferredCall[] = [];
const deleteCalls: DeferredCall[] = [];

const saveChartData = createDeferredMutation(saveCalls);
const deleteChartData = createDeferredMutation(deleteCalls);

vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useSaveChartData: () => ({ mutateAsync: saveChartData, isPending: false }),
  useDeleteChartData: () => ({ mutateAsync: deleteChartData, isPending: false }),
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

import { clearExamObservations } from '../../src/features/visits/shared/components/exam-tab/exam-selection-helpers';
import { useRosObservations } from '../../src/features/visits/shared/hooks/useRosObservations';
import { useExamObservationsStore } from '../../src/features/visits/shared/stores/appointment/exam-observations.store';
import {
  resetPendingObservationFields,
  usePendingObservationFieldsStore,
} from '../../src/features/visits/shared/stores/appointment/pending-observation-fields.store';
import { useRosObservationsStore } from '../../src/features/visits/shared/stores/appointment/ros-observations.store';
import { useExamObservations } from '../../src/features/visits/telemed/hooks/useExamObservations';

beforeEach(() => {
  vi.clearAllMocks();
  saveCalls.length = 0;
  deleteCalls.length = 0;
  useExamObservationsStore.setState({}, true);
  useRosObservationsStore.setState({}, true);
  resetPendingObservationFields();
});

// ============================================================================
// TESTS
// ============================================================================

describe('Clearing the exam while a save is in flight', () => {
  it('deletes the resource the save created instead of merging the value back in', async () => {
    const { result } = renderHook(() => useExamObservations());

    // The debounced provider comment leaves the tab, then the provider clears the exam before the
    // server answers: with no resourceId yet, the clear can only reach the store.
    act(() => result.current.update({ field: 'general-comment', note: 'well appearing' }));
    act(() => clearExamObservations(result.current.value, result.current.delete, { includeNotes: true }));
    expect(deleteCalls).toHaveLength(0);

    await settle(saveCalls[0], {
      chartData: { examObservations: [{ field: 'general-comment', note: 'well appearing', resourceId: 'obs-1' }] },
    });

    expect(deleteChartData).toHaveBeenCalledWith({
      examObservations: [expect.objectContaining({ field: 'general-comment', resourceId: 'obs-1' })],
    });
    expect(useExamObservationsStore.getState()['general-comment'].note).toBe('');
  });

  it('merges the server response as usual when nothing cleared it meanwhile', async () => {
    const { result } = renderHook(() => useExamObservations());

    act(() => result.current.update([{ field: 'alert', value: true }]));
    await settle(saveCalls[0], {
      chartData: { examObservations: [{ field: 'alert', value: true, resourceId: 'obs-2' }] },
    });

    expect(deleteChartData).not.toHaveBeenCalled();
    expect(useExamObservationsStore.getState().alert).toEqual({ field: 'alert', value: true, resourceId: 'obs-2' });
    expect(usePendingObservationFieldsStore.getState().counts).toEqual({});
  });
});

describe('Re-selecting a field that was just cleared', () => {
  it('creates a new exam Observation instead of writing to the deleted one', async () => {
    useExamObservationsStore.setState({ alert: { field: 'alert', value: true, resourceId: 'obs-alert' } }, true);

    const { result } = renderHook(() => useExamObservations());

    // A bulk clear ("Clear Exam", a section "Select all" turned off) deletes through the array form.
    act(() => clearExamObservations(result.current.value, result.current.delete, { includeNotes: true }));

    expect(deleteChartData).toHaveBeenCalledWith({
      examObservations: [expect.objectContaining({ field: 'alert', resourceId: 'obs-alert' })],
    });
    // The deleted resource's id must not survive in the store, or the next save PUTs to a resource
    // the server answers 410 for.
    expect(useExamObservationsStore.getState().alert).toEqual({ field: 'alert', value: false, note: '' });

    await settle(deleteCalls[0], {});

    act(() => result.current.update([{ ...(useExamObservationsStore.getState().alert as any), value: true }]));

    expect(saveChartData).toHaveBeenCalledWith({
      examObservations: [{ field: 'alert', value: true, note: '' }],
    });
  });

  it('creates a new ROS Observation instead of writing to the deleted one', () => {
    useRosObservationsStore.setState(
      {
        'ros-constitutional-fever-denies': { field: 'ros-constitutional-fever-denies', value: true, resourceId: 'r-1' },
      },
      true
    );

    const { result } = renderHook(() => useRosObservations());

    // What "Clear ROS" and an unchecked "Select all" both send: value false with the resourceId.
    act(() =>
      result.current.update([
        { field: 'ros-constitutional-fever-denies', label: 'Fever', value: false, resourceId: 'r-1' },
      ])
    );

    expect(deleteChartData).toHaveBeenCalledWith({
      rosObservations: [expect.objectContaining({ resourceId: 'r-1' })],
    });
    expect(useRosObservationsStore.getState()['ros-constitutional-fever-denies'].resourceId).toBeUndefined();
  });

  it('sends no delete for a field whose save never landed, rather than /Observation/undefined', () => {
    const { result } = renderHook(() => useExamObservations());

    act(() => result.current.delete([{ field: 'alert', value: false, note: '' }]));

    expect(deleteChartData).not.toHaveBeenCalled();
    expect(useExamObservationsStore.getState().alert).toEqual({ field: 'alert', value: false, note: '' });
  });
});

describe('Rolling back a failed write', () => {
  it('drops fields that had no previous value rather than storing undefined', async () => {
    const { result } = renderHook(() => useRosObservations());

    act(() => result.current.update([{ field: 'ros-constitutional-fever-denies', label: 'Fever', value: true }]));
    await fail(saveCalls[0]);

    const state = useRosObservationsStore.getState();
    expect('ros-constitutional-fever-denies' in state).toBe(false);
    // Every ROS consumer reads observation.field off these entries, so a hole must be a hole.
    expect(Object.values(state).every(Boolean)).toBe(true);
    expect(usePendingObservationFieldsStore.getState().counts).toEqual({});
  });

  it('restores the previous value of fields that had one', async () => {
    const previous = { field: 'ros-constitutional-fever-denies', label: 'Fever', value: true, resourceId: 'obs-3' };
    useRosObservationsStore.setState({ 'ros-constitutional-fever-denies': previous }, true);

    const { result } = renderHook(() => useRosObservations());
    act(() => result.current.update([{ field: 'ros-constitutional-fever-reports', label: 'Fever', value: true }]));
    await fail(saveCalls[0]);

    expect(useRosObservationsStore.getState()).toEqual({ 'ros-constitutional-fever-denies': previous });
  });

  it('drops exam fields that had no previous value too', async () => {
    const { result } = renderHook(() => useExamObservations());

    act(() => result.current.update([{ field: 'alert', value: true }]));
    await fail(saveCalls[0]);

    expect('alert' in useExamObservationsStore.getState()).toBe(false);
    expect(usePendingObservationFieldsStore.getState().counts).toEqual({});
  });
});
