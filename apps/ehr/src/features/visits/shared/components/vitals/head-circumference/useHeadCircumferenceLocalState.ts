import { ChangeEvent, useCallback, useState } from 'react';
import { HEIGHT_CM_DISPLAY_PRECISION, HeightMeasurement } from 'utils/lib/helpers/vitals/vitals-height.helper';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VitalsHeadCircumferenceObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { HeadCircumferenceLocalState } from '../types';

type HeadCircumferenceField = 'cm' | 'inches';

const asText = (value: number | undefined): string => (value === undefined ? '' : `${value}`);

// Head circumference is a length, so it reuses the height measurement (cm <-> inches) minus the feet split.
export function useHeadCircumferenceLocalState(): HeadCircumferenceLocalState {
  const [measurement, setMeasurement] = useState<HeightMeasurement | undefined>(undefined);
  // The field being typed in + its raw text; the other field is derived from `measurement`.
  const [editing, setEditing] = useState<{ field: HeadCircumferenceField; text: string } | undefined>(undefined);
  const [isValidationError, setValidationError] = useState<boolean>(false);

  const handleCmChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const text = e.target.value;
    setValidationError(false);
    setEditing({ field: 'cm', text });
    setMeasurement(HeightMeasurement.fromCmText(text));
  }, []);

  const handleInchesChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const text = e.target.value;
    setValidationError(false);
    setEditing({ field: 'inches', text });
    setMeasurement(HeightMeasurement.fromInchesText(text));
  }, []);

  const clearForm = useCallback(() => {
    setMeasurement(undefined);
    setEditing(undefined);
    setValidationError(false);
  }, []);

  const getDTO = useCallback((): VitalsHeadCircumferenceObservationDTO | null => {
    if (!measurement) return null;
    return { field: VitalFieldNames.VitalHeadCircumference, value: measurement.getCm() };
  }, [measurement]);

  const valueFor = (field: HeadCircumferenceField, derived: number | undefined): string =>
    editing?.field === field ? editing.text : asText(derived);

  const isValid = measurement !== undefined;
  const hasData = isValid || (editing?.text.length ?? 0) > 0;

  return {
    valueCm: valueFor('cm', measurement?.getCm(HEIGHT_CM_DISPLAY_PRECISION)),
    valueInches: valueFor('inches', measurement?.getInches()),
    validationError: isValidationError,
    isDisabled: !hasData,
    hasData,
    isValid,
    handleCmChange,
    handleInchesChange,
    setValidationError,
    clearForm,
    getDTO,
  };
}
