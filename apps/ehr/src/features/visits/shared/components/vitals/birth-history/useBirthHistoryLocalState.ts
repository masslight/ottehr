import { DateTime } from 'luxon';
import { useState } from 'react';
import { HEIGHT_CM_DISPLAY_PRECISION, HeightMeasurement } from 'utils/lib/helpers/vitals/vitals-height.helper';
import { LBS_IN_KG } from 'utils/lib/helpers/vitals/vitals-weight.helper';
import { BirthHistory } from 'utils/lib/types/api/birth-history.types';
import { roundNumberToDecimalPlaces, textToNumericValue } from 'utils/lib/utils/convert';
import { PairedMeasureState, usePairedMeasure } from '../usePairedMeasure';

export interface BirthHistoryLocalState {
  timeOfBirth: DateTime | null;
  setTimeOfBirth: (value: DateTime | null) => void;
  weeks: string;
  days: string;
  setWeeks: (text: string) => void;
  setDays: (text: string) => void;
  weight: PairedMeasureState;
  length: PairedMeasureState;
  headCircumference: PairedMeasureState;
  /** The fields to save; undefined while a typed value is not a valid number or the days need weeks. */
  getValue: () => BirthHistory | undefined;
}

export const useBirthHistoryLocalState = (saved?: BirthHistory): BirthHistoryLocalState => {
  const [timeOfBirth, setTimeOfBirth] = useState<DateTime | null>(
    saved?.timeOfBirth ? DateTime.fromFormat(saved.timeOfBirth, 'HH:mm') : null
  );
  const [weeks, setWeeks] = useState(saved?.gestationalAgeWeeks?.toString() ?? '');
  const [days, setDays] = useState(saved?.gestationalAgeDays?.toString() ?? '');
  // Weight from lbs rounds to 2 decimals as the weight card does; lengths keep height's cm/inches precision.
  const weight = usePairedMeasure(
    saved?.birthWeightKg,
    (lbs) => roundNumberToDecimalPlaces(lbs / LBS_IN_KG, 2),
    (kg) => roundNumberToDecimalPlaces(kg * LBS_IN_KG, 2),
    2
  );
  const length = usePairedMeasure(
    saved?.birthLengthCm,
    (inches) => HeightMeasurement.fromInches(inches).getCm(),
    (cm) => HeightMeasurement.fromCm(cm).getInches(),
    HEIGHT_CM_DISPLAY_PRECISION
  );
  const headCircumference = usePairedMeasure(
    saved?.birthHeadCircumferenceCm,
    (inches) => HeightMeasurement.fromInches(inches).getCm(),
    (cm) => HeightMeasurement.fromCm(cm).getInches(),
    HEIGHT_CM_DISPLAY_PRECISION
  );

  const getValue = (): BirthHistory | undefined => {
    const weeksValue = weeks.trim() ? textToNumericValue(weeks) : undefined;
    const daysValue = days.trim() ? textToNumericValue(days) : undefined;
    if ((weeks.trim() && weeksValue === undefined) || (days.trim() && daysValue === undefined)) return undefined;
    if (daysValue !== undefined && weeksValue === undefined) return undefined;
    if (timeOfBirth && !timeOfBirth.isValid) return undefined;
    if (weight.invalid || length.invalid || headCircumference.invalid) return undefined;
    return {
      ...(timeOfBirth ? { timeOfBirth: timeOfBirth.toFormat('HH:mm') } : {}),
      ...(weeksValue !== undefined ? { gestationalAgeWeeks: weeksValue } : {}),
      ...(daysValue !== undefined ? { gestationalAgeDays: daysValue } : {}),
      ...(weight.value !== undefined ? { birthWeightKg: weight.value } : {}),
      ...(length.value !== undefined ? { birthLengthCm: length.value } : {}),
      ...(headCircumference.value !== undefined ? { birthHeadCircumferenceCm: headCircumference.value } : {}),
    };
  };

  return { timeOfBirth, setTimeOfBirth, weeks, days, setWeeks, setDays, weight, length, headCircumference, getValue };
};
