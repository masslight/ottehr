import { ChangeEvent, useCallback, useRef, useState } from 'react';
import { toVitalOxygenSatObservationMethod } from 'utils/lib/fhir/vitals';
import {
  getActiveSupplementalO2Details,
  isValidSupplementalO2FlowRate,
  toVitalsSupplementalO2DeliveryType,
} from 'utils/lib/helpers/vitals/vitals-oxygen-saturation.helper';
import {
  VitalFieldNames,
  VitalsOxygenSatObservationMethod,
  VitalsSupplementalO2DeliveryType,
} from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VitalsOxygenSatObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { textToNumericValue } from 'utils/lib/utils/convert';
import { OxygenSatForm, OxygenSatLocalState } from '../types';
import { textToOxygenSatNumber } from './helpers';

const EMPTY_FORM: OxygenSatForm = {
  value: '',
  observationQualifier: '',
  flowRate: '',
  deliveryType: '',
  deliveryTypeOther: '',
};

const withChange = (form: OxygenSatForm, change: Partial<OxygenSatForm>): OxygenSatForm => {
  const next = { ...form, ...change };
  if (next.observationQualifier !== VitalsOxygenSatObservationMethod.OnSupplementalO2) {
    return { ...next, flowRate: '', deliveryType: '', deliveryTypeOther: '' };
  }
  return next.deliveryType === VitalsSupplementalO2DeliveryType.Other ? next : { ...next, deliveryTypeOther: '' };
};

export function useOxygenSatLocalState(): OxygenSatLocalState {
  const latestForm = useRef(EMPTY_FORM);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isValidationError, setValidationError] = useState<boolean>(false);

  const change = useCallback((fields: Partial<OxygenSatForm>): void => {
    latestForm.current = withChange(latestForm.current, fields);
    setForm(latestForm.current);
    setValidationError(false);
  }, []);

  const handleValueChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => change({ value: e.target.value }),
    [change]
  );

  const handleQualifierChange = useCallback(
    (observationQualifier: string): void => change({ observationQualifier }),
    [change]
  );

  const handleFlowRateChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => change({ flowRate: e.target.value }),
    [change]
  );

  const handleDeliveryTypeChange = useCallback((deliveryType: string): void => change({ deliveryType }), [change]);

  const handleDeliveryTypeOtherChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => change({ deliveryTypeOther: e.target.value }),
    [change]
  );

  const clearForm = useCallback(() => {
    latestForm.current = EMPTY_FORM;
    setForm(EMPTY_FORM);
    setValidationError(false);
  }, []);

  const getForm = useCallback((): OxygenSatForm => latestForm.current, []);

  const flowRate = textToNumericValue(form.flowRate);
  const isFlowRateInvalid =
    form.flowRate.trim() !== '' && (flowRate === undefined || !isValidSupplementalO2FlowRate(flowRate));

  const getDTO = useCallback((): VitalsOxygenSatObservationDTO | null => {
    const oxySatValueNumber = textToOxygenSatNumber(form.value);
    if (oxySatValueNumber === undefined || isFlowRateInvalid) return null;
    const observationMethod = toVitalOxygenSatObservationMethod(form.observationQualifier);
    const supplementalO2 = getActiveSupplementalO2Details(observationMethod, {
      flowRate,
      deliveryType: toVitalsSupplementalO2DeliveryType(form.deliveryType),
      deliveryTypeOther: form.deliveryTypeOther,
    });
    return {
      field: VitalFieldNames.VitalOxygenSaturation,
      value: oxySatValueNumber,
      observationMethod,
      ...(supplementalO2 && { supplementalO2 }),
    };
  }, [form, flowRate, isFlowRateInvalid]);

  const hasData = form.value.length > 0 || form.observationQualifier.length > 0;
  const isValid = getDTO() !== null;
  const isDisabled = !form.value;

  return {
    ...form,
    validationError: isValidationError,
    isValueInvalid: textToOxygenSatNumber(form.value) === undefined,
    isFlowRateInvalid,
    isDisabled,
    hasData,
    isValid,
    handleValueChange,
    handleQualifierChange,
    handleFlowRateChange,
    handleDeliveryTypeChange,
    handleDeliveryTypeOtherChange,
    setValidationError,
    clearForm,
    getDTO,
    getForm,
  };
}
