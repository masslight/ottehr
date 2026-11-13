import { act, renderHook } from '@testing-library/react';
import { ChangeEvent } from 'react';
import { describe, expect, it } from 'vitest';
import { useBirthHistoryLocalState } from '../../src/features/visits/shared/components/vitals/birth-history/useBirthHistoryLocalState';
import { useWeightLocalState } from '../../src/features/visits/shared/components/vitals/weights/useWeightLocalState';

const typed = (value: string): ChangeEvent<HTMLInputElement> =>
  ({ target: { value } }) as ChangeEvent<HTMLInputElement>;

describe('weight card: the field being typed in keeps its text', () => {
  it.each(['7.18', '7.', '7.05', '150.25'])('lbs %s is not rewritten by the round trip through kg', (lbs) => {
    const { result } = renderHook(() => useWeightLocalState());
    act(() => result.current.handleLbsInput(typed(lbs)));
    expect(result.current.lbsText).toBe(lbs);
  });

  it('lbs fills kg to 2 decimals and the saved value is kg', () => {
    const { result } = renderHook(() => useWeightLocalState());
    act(() => result.current.handleLbsInput(typed('7.18')));
    expect(result.current.kgText).toBe('3.26');
    expect(result.current.getDTO()?.value).toBe(3.26);
  });

  it('patient refused empties both fields', () => {
    const { result } = renderHook(() => useWeightLocalState());
    act(() => result.current.handleKgInput(typed('3.2')));
    act(() => result.current.handlePatientRefusedChange(true, 'patient_refused'));
    expect([result.current.kgText, result.current.lbsText, result.current.weightKg]).toEqual(['', '', undefined]);
  });
});

describe('birth history card: a measurement that is not a number blocks Save', () => {
  it('a mistyped birth weight makes the value invalid instead of dropping the weight', () => {
    const { result } = renderHook(() => useBirthHistoryLocalState({ gestationalAgeWeeks: 39, birthWeightKg: 3.25 }));
    act(() => result.current.weight.handleMetricChange(typed('3..2')));
    expect(result.current.weight.invalid).toBe(true);
    expect(result.current.getValue()).toBeUndefined();
  });

  it('clearing the weight field is allowed and removes the weight', () => {
    const { result } = renderHook(() => useBirthHistoryLocalState({ gestationalAgeWeeks: 39, birthWeightKg: 3.25 }));
    act(() => result.current.weight.handleMetricChange(typed('')));
    expect(result.current.getValue()).toEqual({ gestationalAgeWeeks: 39 });
  });
});
