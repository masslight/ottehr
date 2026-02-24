import { ChangeEvent, useCallback, useState } from 'react';
import { VitalFieldNames, VitalsRespirationRateObservationDTO } from 'utils';
import { textToRespirationRateNumber } from './helpers';

export interface RespirationRateLocalState {
  value: string;
  validationError: boolean;
  isDisabled: boolean;
  hasData: boolean;
  isValid: boolean;
  handleValueChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  setValidationError: (error: boolean) => void;
  clearForm: () => void;
  getDTO: () => VitalsRespirationRateObservationDTO | null;
}

export function useRespirationRateLocalState(): RespirationRateLocalState {
  const [respirationRateValueText, setRespirationRateValueText] = useState('');
  const [isValidationError, setValidationError] = useState<boolean>(false);

  const handleValueChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const respirationRateAsText = e.target.value;
    setRespirationRateValueText(respirationRateAsText);
    setValidationError(false);
  }, []);

  const clearForm = useCallback(() => {
    setRespirationRateValueText('');
    setValidationError(false);
  }, []);

  const getDTO = useCallback((): VitalsRespirationRateObservationDTO | null => {
    const respRateValueNumber = textToRespirationRateNumber(respirationRateValueText);
    if (!respRateValueNumber) return null;
    return {
      field: VitalFieldNames.VitalRespirationRate,
      value: respRateValueNumber,
    };
  }, [respirationRateValueText]);

  const hasData = respirationRateValueText.length > 0;
  const isValid = getDTO() !== null;
  const isDisabled = !respirationRateValueText;

  return {
    value: respirationRateValueText,
    validationError: isValidationError,
    isDisabled,
    hasData,
    isValid,
    handleValueChange,
    setValidationError,
    clearForm,
    getDTO,
  };
}
