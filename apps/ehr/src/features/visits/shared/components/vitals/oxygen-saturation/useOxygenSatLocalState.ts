import { ChangeEvent, useCallback, useState } from 'react';
import { toVitalOxygenSatObservationMethod, VitalFieldNames, VitalsOxygenSatObservationDTO } from 'utils';
import { OxygenSatLocalState } from '../types';
import { textToOxygenSatNumber } from './helpers';

export function useOxygenSatLocalState(): OxygenSatLocalState {
  const [oxySatValueText, setOxySatValueText] = useState('');
  const [observationQualifier, setObservationsQualifier] = useState<string>('');
  const [isValidationError, setValidationError] = useState<boolean>(false);

  const handleValueChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const oxySatAsText = e.target.value;
    setOxySatValueText(oxySatAsText);
    setValidationError(false);
  }, []);

  const handleQualifierChange = useCallback((qualifier: string): void => {
    setObservationsQualifier(qualifier);
    setValidationError(false);
  }, []);

  const clearForm = useCallback(() => {
    setOxySatValueText('');
    setObservationsQualifier('');
    setValidationError(false);
  }, []);

  const getDTO = useCallback((): VitalsOxygenSatObservationDTO | null => {
    const oxySatValueNumber = textToOxygenSatNumber(oxySatValueText);
    if (oxySatValueNumber === undefined) return null;
    return {
      field: VitalFieldNames.VitalOxygenSaturation,
      value: oxySatValueNumber,
      observationMethod: toVitalOxygenSatObservationMethod(observationQualifier),
    };
  }, [oxySatValueText, observationQualifier]);

  const hasData = oxySatValueText.length > 0 || observationQualifier.length > 0;
  const isValid = getDTO() !== null;
  const isDisabled = !oxySatValueText;

  return {
    value: oxySatValueText,
    observationQualifier,
    validationError: isValidationError,
    isDisabled,
    hasData,
    isValid,
    handleValueChange,
    handleQualifierChange,
    setValidationError,
    clearForm,
    getDTO,
  };
}
