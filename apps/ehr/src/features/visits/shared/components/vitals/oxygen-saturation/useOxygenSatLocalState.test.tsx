import { act, renderHook } from '@testing-library/react';
import { ChangeEvent } from 'react';
import {
  VitalFieldNames,
  VitalsOxygenSatObservationMethod,
  VitalsSupplementalO2DeliveryType,
} from 'utils/lib/types/api/chart-data/chart-data.constants';
import { describe, expect, it } from 'vitest';
import { useOxygenSatLocalState } from './useOxygenSatLocalState';

const createChangeEvent = (value: string): ChangeEvent<HTMLInputElement> =>
  ({ target: { value } }) as ChangeEvent<HTMLInputElement>;

const renderOnSupplementalO2 = (): { current: ReturnType<typeof useOxygenSatLocalState> } => {
  const { result } = renderHook(() => useOxygenSatLocalState());
  act(() => {
    result.current.handleValueChange(createChangeEvent('93'));
    result.current.handleQualifierChange(VitalsOxygenSatObservationMethod.OnSupplementalO2);
  });
  return result;
};

const setFlowRate = (result: { current: ReturnType<typeof useOxygenSatLocalState> }, flowRate: string): void => {
  act(() => result.current.handleFlowRateChange(createChangeEvent(flowRate)));
};

describe('useOxygenSatLocalState — supplemental O2 details', () => {
  it.each(['', '   '])('treats an empty flow rate (%j) as not recorded', (flowRate) => {
    const result = renderOnSupplementalO2();
    setFlowRate(result, flowRate);

    expect(result.current.isFlowRateInvalid).toBe(false);
    expect(result.current.getDTO()).toEqual({
      field: VitalFieldNames.VitalOxygenSaturation,
      value: 93,
      observationMethod: VitalsOxygenSatObservationMethod.OnSupplementalO2,
    });
  });

  it.each([
    ['0', 0],
    ['0.5', 0.5],
    ['12.25', 12.25],
  ])('accepts the flow rate %s', (flowRate, expected) => {
    const result = renderOnSupplementalO2();
    setFlowRate(result, flowRate);

    expect(result.current.isValid).toBe(true);
    expect(result.current.getDTO()?.supplementalO2).toEqual({ flowRate: expected });
  });

  it.each(['-1', '-0.5', 'abc', '2 L', 'Infinity'])('rejects the flow rate %j instead of dropping it', (flowRate) => {
    const result = renderOnSupplementalO2();
    setFlowRate(result, flowRate);

    expect(result.current.isFlowRateInvalid).toBe(true);
    expect(result.current.isValueInvalid).toBe(false);
    expect(result.current.isValid).toBe(false);
    expect(result.current.getDTO()).toBeNull();
  });

  it('omits whitespace-only Other text but keeps the Other type', () => {
    const result = renderOnSupplementalO2();
    act(() => {
      result.current.handleDeliveryTypeChange(VitalsSupplementalO2DeliveryType.Other);
      result.current.handleDeliveryTypeOtherChange(createChangeEvent('   '));
    });

    expect(result.current.getDTO()?.supplementalO2).toEqual({ deliveryType: VitalsSupplementalO2DeliveryType.Other });
  });

  it('clears the details when the qualifier is cleared', () => {
    const result = renderOnSupplementalO2();
    setFlowRate(result, '-3');
    act(() => {
      result.current.handleDeliveryTypeChange(VitalsSupplementalO2DeliveryType.Other);
      result.current.handleDeliveryTypeOtherChange(createChangeEvent('Face tent'));
    });

    act(() => result.current.handleQualifierChange(''));

    expect(result.current).toMatchObject({ flowRate: '', deliveryType: '', deliveryTypeOther: '' });
    expect(result.current.isFlowRateInvalid).toBe(false);
    expect(result.current.getDTO()).toEqual({ field: VitalFieldNames.VitalOxygenSaturation, value: 93 });
  });

  it('clearForm resets the details with the rest of the form', () => {
    const result = renderOnSupplementalO2();
    setFlowRate(result, '4');
    act(() => result.current.handleDeliveryTypeChange(VitalsSupplementalO2DeliveryType.VenturiMask));

    act(() => result.current.clearForm());

    expect(result.current).toMatchObject({
      value: '',
      observationQualifier: '',
      flowRate: '',
      deliveryType: '',
      deliveryTypeOther: '',
      hasData: false,
    });
  });
});
