import { act, renderHook } from '@testing-library/react';
import { ChangeEvent } from 'react';
import { VitalFieldNames } from 'utils';
import { describe, expect, it } from 'vitest';
import { INVALID_BLOOD_PRESSURE_MESSAGE, useBloodPressureLocalState } from './useBloodPressureLocalState';

const createChangeEvent = (value: string): ChangeEvent<HTMLInputElement> =>
  ({ target: { value } }) as ChangeEvent<HTMLInputElement>;

const setBloodPressureValues = (
  result: { current: ReturnType<typeof useBloodPressureLocalState> },
  systolic: string,
  diastolic: string
): void => {
  act(() => {
    result.current.handleSystolicChange(createChangeEvent(systolic));
    result.current.handleDiastolicChange(createChangeEvent(diastolic));
  });
};

describe('useBloodPressureLocalState', () => {
  it('returns a DTO for valid blood pressure values', () => {
    const { result } = renderHook(() => useBloodPressureLocalState());

    setBloodPressureValues(result, '120', '80');

    expect(result.current.isValid).toBe(true);
    expect(result.current.validationErrorMessage).toBeUndefined();
    expect(result.current.getDTO()).toEqual({
      field: VitalFieldNames.VitalBloodPressure,
      systolicPressure: 120,
      diastolicPressure: 80,
      observationMethod: undefined,
    });
  });

  it('is invalid when diastolic blood pressure is greater than systolic', () => {
    const { result } = renderHook(() => useBloodPressureLocalState());

    setBloodPressureValues(result, '110', '115');

    expect(result.current.isValid).toBe(false);
    expect(result.current.isSystolicInvalid).toBe(false);
    expect(result.current.isDiastolicInvalid).toBe(true);
    expect(result.current.validationErrorMessage).toBe(INVALID_BLOOD_PRESSURE_MESSAGE);
    expect(result.current.getDTO()).toBeNull();
  });

  it('is invalid when diastolic blood pressure equals systolic', () => {
    const { result } = renderHook(() => useBloodPressureLocalState());

    setBloodPressureValues(result, '110', '110');

    expect(result.current.isValid).toBe(false);
    expect(result.current.isDiastolicInvalid).toBe(true);
    expect(result.current.validationErrorMessage).toBe(INVALID_BLOOD_PRESSURE_MESSAGE);
    expect(result.current.getDTO()).toBeNull();
  });

  it('preserves missing field validation behavior', () => {
    const { result } = renderHook(() => useBloodPressureLocalState());

    setBloodPressureValues(result, '', '80');

    expect(result.current.isValid).toBe(false);
    expect(result.current.isSystolicInvalid).toBe(true);
    expect(result.current.isDiastolicInvalid).toBe(false);
    expect(result.current.validationErrorMessage).toBeUndefined();
    expect(result.current.getDTO()).toBeNull();
  });

  it('preserves non-numeric field validation behavior', () => {
    const { result } = renderHook(() => useBloodPressureLocalState());

    setBloodPressureValues(result, 'abc', '80');

    expect(result.current.isValid).toBe(false);
    expect(result.current.isSystolicInvalid).toBe(true);
    expect(result.current.isDiastolicInvalid).toBe(false);
    expect(result.current.validationErrorMessage).toBeUndefined();
    expect(result.current.getDTO()).toBeNull();
  });
});
