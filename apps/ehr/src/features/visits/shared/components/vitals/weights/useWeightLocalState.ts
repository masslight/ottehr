import { ChangeEvent, useCallback, useState } from 'react';
import {
  LBS_IN_KG,
  roundNumberToDecimalPlaces,
  textToNumericValue,
  VitalFieldNames,
  VitalsWeightObservationDTO,
  VitalsWeightOption,
} from 'utils';

export interface WeightLocalState {
  weightKg: number | undefined;
  isPatientRefusedSelected: boolean;
  validationError: boolean;
  isDisabled: boolean;
  hasData: boolean;
  isValid: boolean;
  handleKgInput: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleLbsInput: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handlePatientRefusedChange: (isChecked: boolean, weightOption: VitalsWeightOption) => void;
  setValidationError: (error: boolean) => void;
  clearForm: () => void;
  getDTO: () => VitalsWeightObservationDTO | null;
}

export function useWeightLocalState(): WeightLocalState {
  const [weightKg, setWeightKg] = useState<number | undefined>(undefined);
  const [isPatientRefusedOptionSelected, setOptionRefusedOptionSelected] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<boolean>(false);

  const handleKgInput = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    setWeightKg(textToNumericValue(e.target.value));
    setValidationError(false);
  }, []);

  const handleLbsInput = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const numericValue = textToNumericValue(e.target.value);
    if (numericValue !== undefined) {
      setWeightKg(roundNumberToDecimalPlaces(numericValue / LBS_IN_KG, 2));
    } else {
      setWeightKg(undefined);
    }
    setValidationError(false);
  }, []);

  const handlePatientRefusedChange = useCallback((isChecked: boolean, weightOption: VitalsWeightOption): void => {
    if (weightOption !== 'patient_refused') return;
    setOptionRefusedOptionSelected(isChecked);
    setWeightKg(undefined);
    setValidationError(false);
  }, []);

  const clearForm = useCallback(() => {
    setWeightKg(undefined);
  }, []);

  const getDTO = useCallback((): VitalsWeightObservationDTO | null => {
    if (isPatientRefusedOptionSelected) {
      return {
        field: VitalFieldNames.VitalWeight,
        extraWeightOptions: ['patient_refused'],
      };
    }

    if (!weightKg) return null;

    return {
      field: VitalFieldNames.VitalWeight,
      value: weightKg,
    };
  }, [weightKg, isPatientRefusedOptionSelected]);

  const hasData = weightKg !== undefined || isPatientRefusedOptionSelected;
  const isValid = isPatientRefusedOptionSelected || getDTO() !== null;
  const isDisabled = !weightKg;

  return {
    weightKg,
    isPatientRefusedSelected: isPatientRefusedOptionSelected,
    validationError,
    isDisabled,
    hasData,
    isValid,
    handleKgInput,
    handleLbsInput,
    handlePatientRefusedChange,
    setValidationError,
    clearForm,
    getDTO,
  };
}
