import { ChangeEvent, useCallback, useState } from 'react';
import { toVitalOxygenSatObservationMethod, toVitalsSupplementalO2DeliveryType } from 'utils/lib/fhir/vitals';
import {
  getActiveSupplementalO2Details,
  isValidSupplementalO2FlowRate,
} from 'utils/lib/helpers/vitals/vitals-oxygen-saturation.helper';
import {
  VitalFieldNames,
  VitalsOxygenSatObservationMethod,
  VitalsSupplementalO2DeliveryType,
} from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VitalsOxygenSatObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { textToNumericValue } from 'utils/lib/utils/convert';
import { OxygenSatLocalState } from '../types';
import { textToOxygenSatNumber } from './helpers';

export function useOxygenSatLocalState(): OxygenSatLocalState {
  const [oxySatValueText, setOxySatValueText] = useState('');
  const [observationQualifier, setObservationsQualifier] = useState<string>('');
  const [flowRateText, setFlowRateText] = useState('');
  const [deliveryType, setDeliveryType] = useState('');
  const [deliveryTypeOther, setDeliveryTypeOther] = useState('');
  const [isValidationError, setValidationError] = useState<boolean>(false);

  const handleValueChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const oxySatAsText = e.target.value;
    setOxySatValueText(oxySatAsText);
    setValidationError(false);
  }, []);

  const handleQualifierChange = useCallback((qualifier: string): void => {
    setObservationsQualifier(qualifier);
    // The supplemental O2 details are hidden for any other qualifier, so they are cleared rather than kept stale.
    if (qualifier !== VitalsOxygenSatObservationMethod.OnSupplementalO2) {
      setFlowRateText('');
      setDeliveryType('');
      setDeliveryTypeOther('');
    }
    setValidationError(false);
  }, []);

  const handleFlowRateChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    setFlowRateText(e.target.value);
    setValidationError(false);
  }, []);

  const handleDeliveryTypeChange = useCallback((type: string): void => {
    setDeliveryType(type);
    if (type !== VitalsSupplementalO2DeliveryType.Other) {
      setDeliveryTypeOther('');
    }
    setValidationError(false);
  }, []);

  const handleDeliveryTypeOtherChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    setDeliveryTypeOther(e.target.value);
    setValidationError(false);
  }, []);

  const clearForm = useCallback(() => {
    setOxySatValueText('');
    setObservationsQualifier('');
    setFlowRateText('');
    setDeliveryType('');
    setDeliveryTypeOther('');
    setValidationError(false);
  }, []);

  // An empty flow rate is simply not recorded; anything else must be a non-negative number.
  const flowRate = textToNumericValue(flowRateText);
  const isFlowRateInvalid =
    flowRateText.trim() !== '' && (flowRate === undefined || !isValidSupplementalO2FlowRate(flowRate));

  const getDTO = useCallback((): VitalsOxygenSatObservationDTO | null => {
    const oxySatValueNumber = textToOxygenSatNumber(oxySatValueText);
    if (oxySatValueNumber === undefined || isFlowRateInvalid) return null;
    const observationMethod = toVitalOxygenSatObservationMethod(observationQualifier);
    const supplementalO2 = getActiveSupplementalO2Details(observationMethod, {
      flowRate,
      deliveryType: toVitalsSupplementalO2DeliveryType(deliveryType),
      deliveryTypeOther,
    });
    return {
      field: VitalFieldNames.VitalOxygenSaturation,
      value: oxySatValueNumber,
      observationMethod,
      ...(supplementalO2 && { supplementalO2 }),
    };
  }, [oxySatValueText, observationQualifier, flowRate, isFlowRateInvalid, deliveryType, deliveryTypeOther]);

  const hasData = oxySatValueText.length > 0 || observationQualifier.length > 0;
  const isValid = getDTO() !== null;
  const isDisabled = !oxySatValueText;

  return {
    value: oxySatValueText,
    observationQualifier,
    flowRate: flowRateText,
    deliveryType,
    deliveryTypeOther,
    validationError: isValidationError,
    isValueInvalid: textToOxygenSatNumber(oxySatValueText) === undefined,
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
  };
}
