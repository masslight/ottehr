import { ChangeEvent, useCallback, useState } from 'react';
import { kgToLbs, LBS_IN_KG } from 'utils/lib/helpers/vitals/vitals-weight.helper';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VitalsWeightObservationDTO, VitalsWeightOption } from 'utils/lib/types/api/chart-data/chart-data.types';
import { roundNumberToDecimalPlaces } from 'utils/lib/utils/convert';
import { WeightLocalState } from '../types';
import { usePairedMeasure } from '../usePairedMeasure';

export function useWeightLocalState(): WeightLocalState {
  // The field being typed in keeps its text, so a lbs value is not rewritten by the round trip through kg.
  const weight = usePairedMeasure(undefined, (lbs) => roundNumberToDecimalPlaces(lbs / LBS_IN_KG, 2), kgToLbs, 2);
  const weightKg = weight.value;
  const [isPatientRefusedOptionSelected, setOptionRefusedOptionSelected] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<boolean>(false);

  const handleKgInput = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    weight.handleMetricChange(e);
    setValidationError(false);
  };

  const handleLbsInput = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    weight.handleImperialChange(e);
    setValidationError(false);
  };

  const handlePatientRefusedChange = (isChecked: boolean, weightOption: VitalsWeightOption): void => {
    if (weightOption !== 'patient_refused') return;
    setOptionRefusedOptionSelected(isChecked);
    weight.clear();
    setValidationError(false);
  };

  const clearForm = (): void => weight.clear();

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
    kgText: weight.metricText,
    lbsText: weight.imperialText,
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
