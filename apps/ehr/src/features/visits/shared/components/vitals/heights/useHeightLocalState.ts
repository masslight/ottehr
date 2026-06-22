import { ChangeEvent, useCallback, useState } from 'react';
import { HEIGHT_CM_DISPLAY_PRECISION, HeightMeasurement, VitalFieldNames, VitalsHeightObservationDTO } from 'utils';
import { HeightLocalState } from '../types';

type HeightField = 'cm' | 'inches' | 'feet' | 'inchRemainder';

const asText = (value: number | undefined): string => (value === undefined ? '' : `${value}`);

export function useHeightLocalState(): HeightLocalState {
  const [measurement, setMeasurement] = useState<HeightMeasurement | undefined>(undefined);
  // The field being typed in + its raw text. Every other field is derived from
  // `measurement`, so the inputs can never drift apart. We only keep raw text
  // for the active field so in-progress values like "169." aren't reparsed away.
  const [editing, setEditing] = useState<{ field: HeightField; text: string } | undefined>(undefined);
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

  const handleFeetChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      const text = e.target.value;
      const inchRemainder = editing?.field === 'inchRemainder' ? editing.text : asText(measurement?.getInchRemainder());
      setValidationError(false);
      setEditing({ field: 'feet', text });
      setMeasurement(HeightMeasurement.fromFeetInchesText(text, inchRemainder));
    },
    [editing, measurement]
  );

  const handleInchRemainderChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      const text = e.target.value;
      const feet = editing?.field === 'feet' ? editing.text : asText(measurement?.getFeet());
      setValidationError(false);
      setEditing({ field: 'inchRemainder', text });
      setMeasurement(HeightMeasurement.fromFeetInchesText(feet, text));
    },
    [editing, measurement]
  );

  const clearForm = useCallback(() => {
    setMeasurement(undefined);
    setEditing(undefined);
    setValidationError(false);
  }, []);

  const getDTO = useCallback((): VitalsHeightObservationDTO | null => {
    if (!measurement) return null;
    return { field: VitalFieldNames.VitalHeight, value: measurement.getCm() };
  }, [measurement]);

  const valueFor = (field: HeightField, derived: number | undefined): string =>
    editing?.field === field ? editing.text : asText(derived);

  const isValid = measurement !== undefined;
  const hasData = isValid || (editing?.text.length ?? 0) > 0;

  return {
    valueCm: valueFor('cm', measurement?.getCm(HEIGHT_CM_DISPLAY_PRECISION)),
    valueInches: valueFor('inches', measurement?.getInches()),
    valueFeet: valueFor('feet', measurement?.getFeet()),
    valueInchRemainder: valueFor('inchRemainder', measurement?.getInchRemainder()),
    validationError: isValidationError,
    isDisabled: !hasData,
    hasData,
    isValid,
    handleCmChange,
    handleInchesChange,
    handleFeetChange,
    handleInchRemainderChange,
    setValidationError,
    clearForm,
    getDTO,
  };
}
