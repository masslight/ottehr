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

describe('birth history card: gestational age follows the server rules', () => {
  const withAge = (weeks: string, days: string): ReturnType<typeof useBirthHistoryLocalState> => {
    const { result } = renderHook(() => useBirthHistoryLocalState());
    act(() => result.current.setWeeks(weeks));
    act(() => result.current.setDays(days));
    return result.current;
  };

  it.each([
    ['50', '', 'Enter gestational age weeks as a whole number from 20 to 45'],
    ['15', '', 'Enter gestational age weeks as a whole number from 20 to 45'],
    ['38.5', '', 'Enter gestational age weeks as a whole number from 20 to 45'],
    ['38', '7', 'Enter gestational age days as a whole number from 0 to 6'],
    ['', '3', 'Enter the weeks for the gestational age days'],
  ])('weeks %s, days %s blocks Save with the reason', (weeks, days, reason) => {
    const state = withAge(weeks, days);
    expect(state.getValue()).toBeUndefined();
    expect(state.invalidReason).toBe(reason);
  });

  it('marks the field the server would reject', () => {
    expect([withAge('50', '').weeksInvalid, withAge('50', '').daysInvalid]).toEqual([true, false]);
    expect([withAge('38', '7').weeksInvalid, withAge('38', '7').daysInvalid]).toEqual([false, true]);
  });

  it('20 to 45 weeks and 0 to 6 days save', () => {
    expect(withAge('20', '0').getValue()).toEqual({ gestationalAgeWeeks: 20, gestationalAgeDays: 0 });
    expect(withAge('45', '6').invalidReason).toBeUndefined();
  });
});
