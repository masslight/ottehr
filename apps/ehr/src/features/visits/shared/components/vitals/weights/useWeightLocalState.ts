import { ChangeEvent, useCallback, useState } from 'react';
import { LBS_IN_KG } from 'utils/lib/helpers/vitals/vitals-weight.helper';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VitalsWeightObservationDTO, VitalsWeightOption } from 'utils/lib/types/api/chart-data/chart-data.types';
import { roundNumberToDecimalPlaces, textToNumericValue } from 'utils/lib/utils/convert';
import { WeightLocalState } from '../types';

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
