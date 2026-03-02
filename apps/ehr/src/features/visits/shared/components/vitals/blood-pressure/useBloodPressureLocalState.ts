import { ChangeEvent, useCallback, useState } from 'react';
import { toVitalBloodPressureObservationMethod, VitalFieldNames, VitalsBloodPressureObservationDTO } from 'utils';
import { BloodPressureLocalState } from '../types';
import { textToBloodPressureNumber } from './helpers';

export function useBloodPressureLocalState(): BloodPressureLocalState {
  const [systolicValueText, setSystolicValueText] = useState('');
  const [diastolicValueText, setDiastolicValueText] = useState('');
  const [observationQualifier, setObservationsQualifier] = useState<string>('');
  const [isValidationError, setValidationError] = useState<boolean>(false);

  const handleSystolicChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const systolicAsText = e.target.value;
    setSystolicValueText(systolicAsText);
    setValidationError(false);
  }, []);

  const handleDiastolicChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const diastolicAsText = e.target.value;
    setDiastolicValueText(diastolicAsText);
    setValidationError(false);
  }, []);

  const handleQualifierChange = useCallback((qualifier: string): void => {
    setObservationsQualifier(qualifier);
    setValidationError(false);
  }, []);

  const clearForm = useCallback(() => {
    setSystolicValueText('');
    setDiastolicValueText('');
    setObservationsQualifier('');
    setValidationError(false);
  }, []);

  const getDTO = useCallback((): VitalsBloodPressureObservationDTO | null => {
    const systolicValueNum = textToBloodPressureNumber(systolicValueText);
    const diastolicValueNum = textToBloodPressureNumber(diastolicValueText);
    if (systolicValueNum === undefined || diastolicValueNum === undefined) return null;
    return {
      field: VitalFieldNames.VitalBloodPressure,
      systolicPressure: systolicValueNum,
      diastolicPressure: diastolicValueNum,
      observationMethod: toVitalBloodPressureObservationMethod(observationQualifier),
    };
  }, [systolicValueText, diastolicValueText, observationQualifier]);

  const hasData = systolicValueText.length > 0 || diastolicValueText.length > 0 || observationQualifier.length > 0;
  const isValid = getDTO() !== null;
  const isDisabled = !systolicValueText || !diastolicValueText;

  const isSystolicInvalid = ((): boolean => {
    if (systolicValueText.length > 0) {
      return !textToBloodPressureNumber(systolicValueText);
    }
    return diastolicValueText.length > 0 || observationQualifier.length > 0;
  })();

  const isDiastolicInvalid = ((): boolean => {
    if (diastolicValueText.length > 0) {
      return !textToBloodPressureNumber(diastolicValueText);
    }
    return systolicValueText.length > 0 || observationQualifier.length > 0;
  })();

  return {
    systolicValue: systolicValueText,
    diastolicValue: diastolicValueText,
    observationQualifier,
    validationError: isValidationError,
    isSystolicInvalid,
    isDiastolicInvalid,
    isDisabled,
    hasData,
    isValid,
    handleSystolicChange,
    handleDiastolicChange,
    handleQualifierChange,
    setValidationError,
    clearForm,
    getDTO,
  };
}
