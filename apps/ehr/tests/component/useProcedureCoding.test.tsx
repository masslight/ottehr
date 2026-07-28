import { act, renderHook } from '@testing-library/react';
import { CPT_RULES_VINTAGE, EvaluationFamilyMatchKind, ProcedureFactsInput } from 'utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ProcedureCodingEvaluationStateKind,
  useProcedureCoding,
} from '../../src/features/visits/in-person/hooks/useProcedureCoding';

const LACERATION_FACTS: ProcedureFactsInput = {
  procedureType: 'Laceration Repair',
  bodySite: 'Hand',
  lengthCm: 3.2,
  repairDepth: 'subcutaneous-layered',
  procedureDetails: 'Layered closure performed on the hand.',
};

describe('useProcedureCoding temporal state', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts explicitly evaluating and becomes ready with both directions after the debounce', () => {
    const { result } = renderHook(() => useProcedureCoding(LACERATION_FACTS));

    expect(result.current.rulesVintage).toBe(CPT_RULES_VINTAGE);
    expect(result.current.evaluationState).toEqual({
      kind: ProcedureCodingEvaluationStateKind.Evaluating,
      previous: null,
    });

    act(() => vi.advanceTimersByTime(500));

    expect(result.current.evaluationState.kind).toBe(ProcedureCodingEvaluationStateKind.Ready);
    if (result.current.evaluationState.kind !== ProcedureCodingEvaluationStateKind.Ready) {
      throw new Error('Expected the coding evaluation to be ready');
    }
    expect(result.current.evaluationState.current.suggestion.family).toEqual({
      kind: EvaluationFamilyMatchKind.Matched,
      id: 'laceration',
    });
    expect(result.current.evaluationState.current.defense.family).toEqual({
      kind: EvaluationFamilyMatchKind.Matched,
      id: 'laceration',
    });
  });

  it('retains the previous result only while reevaluating the same family', () => {
    const { result, rerender } = renderHook(({ facts }) => useProcedureCoding(facts), {
      initialProps: { facts: LACERATION_FACTS },
    });
    act(() => vi.advanceTimersByTime(500));

    rerender({
      facts: { ...LACERATION_FACTS, procedureDetails: 'Layered hand closure. Tetanus status reviewed.' },
    });

    expect(result.current.evaluationState.kind).toBe(ProcedureCodingEvaluationStateKind.Evaluating);
    if (result.current.evaluationState.kind !== ProcedureCodingEvaluationStateKind.Evaluating) {
      throw new Error('Expected reevaluation after changing the note');
    }
    expect(result.current.evaluationState.previous?.suggestion.family).toEqual({
      kind: EvaluationFamilyMatchKind.Matched,
      id: 'laceration',
    });

    rerender({
      facts: {
        procedureType: 'Diagnostic EKG',
        procedureDetails: '12-lead EKG obtained. Rate 82, normal sinus rhythm.',
      },
    });

    expect(result.current.evaluationState).toEqual({
      kind: ProcedureCodingEvaluationStateKind.Evaluating,
      previous: null,
    });
  });

  it('cancels a superseded timer instead of publishing stale facts', () => {
    const { result, rerender } = renderHook(({ facts }) => useProcedureCoding(facts), {
      initialProps: { facts: LACERATION_FACTS },
    });

    act(() => vi.advanceTimersByTime(499));
    rerender({ facts: { ...LACERATION_FACTS, lengthCm: 4.1 } });
    act(() => vi.advanceTimersByTime(1));

    expect(result.current.evaluationState.kind).toBe(ProcedureCodingEvaluationStateKind.Evaluating);

    act(() => vi.advanceTimersByTime(499));
    expect(result.current.evaluationState.kind).toBe(ProcedureCodingEvaluationStateKind.Ready);
  });

  it('publishes an explicit unmatched result for an unsupported procedure type', () => {
    const { result } = renderHook(() => useProcedureCoding({ procedureType: 'X-Ray' }));

    act(() => vi.advanceTimersByTime(500));

    expect(result.current.evaluationState.kind).toBe(ProcedureCodingEvaluationStateKind.Ready);
    if (result.current.evaluationState.kind !== ProcedureCodingEvaluationStateKind.Ready) {
      throw new Error('Expected the unsupported procedure evaluation to be ready');
    }
    expect(result.current.evaluationState.current.suggestion.family).toEqual({
      kind: EvaluationFamilyMatchKind.Unmatched,
    });
  });
});
