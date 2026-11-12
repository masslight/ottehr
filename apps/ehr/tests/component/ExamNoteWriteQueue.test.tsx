import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeferredMutation, DeferredCall, settle } from './helpers/deferred-chart-data-mutations';

const saveCalls: DeferredCall[] = [];
const deleteCalls: DeferredCall[] = [];

const saveChartData = createDeferredMutation(saveCalls);
const deleteChartData = createDeferredMutation(deleteCalls);

vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useSaveChartData: () => ({ mutateAsync: saveChartData, isPending: false }),
  useDeleteChartData: () => ({ mutateAsync: deleteChartData, isPending: false }),
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

import { ExamCommentField } from '../../src/features/visits/shared/components/exam-tab/ExamCommentField';
import { useExamObservationsStore } from '../../src/features/visits/shared/stores/appointment/exam-observations.store';
import {
  resetPendingObservationFields,
  usePendingObservationFieldsStore,
} from '../../src/features/visits/shared/stores/appointment/pending-observation-fields.store';
import { useExamObservations } from '../../src/features/visits/telemed/hooks/useExamObservations';

const FIELD = 'general-comment';

const savedObservation = (call: DeferredCall): { field: string; note: string; resourceId?: string } =>
  call.variables.examObservations[0];

const saved = (field: string, note: string, resourceId: string): object => ({
  chartData: { examObservations: [{ field, note, resourceId }] },
});

const renderCommentField = (): { box: HTMLElement; typeText: (text: string) => void } => {
  render(<ExamCommentField name={FIELD} />);
  const box = screen.getByRole('textbox');
  const typeText = (text: string): void => {
    fireEvent.change(box, { target: { value: text } });
    act(() => vi.advanceTimersByTime(700));
  };
  return { box, typeText };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  saveCalls.length = 0;
  deleteCalls.length = 0;
  useExamObservationsStore.setState({}, true);
  resetPendingObservationFields();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Typing a provider comment while an earlier save is in flight', () => {
  it('never lets a queued older comment overwrite the newer one', async () => {
    const { box, typeText } = renderCommentField();

    typeText('Patient');
    typeText('Patient looks');
    await settle(saveCalls[0], saved(FIELD, 'Patient', 'obs-1'));
    typeText('Patient looks well');
    await settle(saveCalls[1], saved(FIELD, 'Patient looks well', 'obs-1'));
    act(() => vi.advanceTimersByTime(3000));

    expect(saveCalls.map(savedObservation)).toEqual([
      expect.objectContaining({ note: 'Patient' }),
      expect.objectContaining({ note: 'Patient looks well', resourceId: 'obs-1' }),
    ]);
    expect(useExamObservationsStore.getState()[FIELD].note).toBe('Patient looks well');
    expect(box).toHaveValue('Patient looks well');
    expect(usePendingObservationFieldsStore.getState().counts).toEqual({});
  });

  it('keeps the newer words when the queued older comment fires while the provider is still typing', async () => {
    const { box, typeText } = renderCommentField();

    typeText('Patient');
    typeText('Patient looks');
    await settle(saveCalls[0], saved(FIELD, 'Patient', 'obs-1'));
    act(() => vi.advanceTimersByTime(600));
    fireEvent.change(box, { target: { value: 'Patient looks well' } });
    act(() => vi.advanceTimersByTime(400));
    await settle(saveCalls[1], saved(FIELD, 'Patient looks', 'obs-1'));
    typeText(`${(box as HTMLTextAreaElement).value} today`);
    act(() => vi.advanceTimersByTime(3000));

    expect(box).toHaveValue('Patient looks well today');
    expect(saveCalls.map(savedObservation).at(-1)).toEqual(
      expect.objectContaining({ note: 'Patient looks well today' })
    );
  });

  it('does not bring back a comment the provider cleared while a save was queued', async () => {
    const { box, typeText } = renderCommentField();

    typeText('Patient');
    typeText('Patient looks');
    typeText('');
    await settle(saveCalls[0], saved(FIELD, 'Patient', 'obs-1'));
    act(() => vi.advanceTimersByTime(3000));

    expect(saveCalls.map(savedObservation)).toEqual([expect.objectContaining({ note: 'Patient' })]);
    expect(deleteChartData).toHaveBeenCalledWith({
      examObservations: [expect.objectContaining({ field: FIELD, resourceId: 'obs-1' })],
    });
    expect(box).toHaveValue('');
  });
});

describe('Note writes queued for different fields on one hook instance', () => {
  it('saves every field queued behind an in-flight save, not only the latest one', async () => {
    const { result } = renderHook(() => useExamObservations(['finding-a', 'finding-b', 'finding-c']));

    act(() => result.current.update({ field: 'finding-a', value: true, note: 'a' }));
    act(() => result.current.update({ field: 'finding-b', value: true, note: 'b' }));
    await settle(saveCalls[0], saved('finding-a', 'a', 'obs-a'));
    act(() => result.current.update({ field: 'finding-c', value: true, note: 'c' }));
    await settle(saveCalls[1], saved('finding-c', 'c', 'obs-c'));
    act(() => vi.advanceTimersByTime(1000));

    expect(saveCalls.map((call) => savedObservation(call).field)).toEqual(['finding-a', 'finding-c', 'finding-b']);
  });

  it('keeps writes queued for two fields behind the same in-flight save', async () => {
    const { result } = renderHook(() => useExamObservations(['finding-a', 'finding-b', 'finding-c']));

    act(() => result.current.update({ field: 'finding-a', value: true, note: 'a' }));
    act(() => result.current.update({ field: 'finding-b', value: true, note: 'b' }));
    act(() => result.current.update({ field: 'finding-c', value: true, note: 'c' }));
    await settle(saveCalls[0], saved('finding-a', 'a', 'obs-a'));
    act(() => vi.advanceTimersByTime(1000));
    await settle(saveCalls[1], saved('finding-b', 'b', 'obs-b'));
    act(() => vi.advanceTimersByTime(1000));
    await settle(saveCalls[2], saved('finding-c', 'c', 'obs-c'));

    expect(saveCalls.map((call) => savedObservation(call).field)).toEqual(['finding-a', 'finding-b', 'finding-c']);
    expect(usePendingObservationFieldsStore.getState().counts).toEqual({});
  });
});
