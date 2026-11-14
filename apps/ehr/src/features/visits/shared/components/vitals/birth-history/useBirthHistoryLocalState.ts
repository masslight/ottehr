import { DateTime } from 'luxon';
import { useState } from 'react';
import { HEIGHT_CM_DISPLAY_PRECISION, HeightMeasurement } from 'utils/lib/helpers/vitals/vitals-height.helper';
import { LBS_IN_KG } from 'utils/lib/helpers/vitals/vitals-weight.helper';
import {
  BirthHistory,
  BirthHistorySchema,
  GESTATIONAL_AGE_WEEKS_MAX,
  GESTATIONAL_AGE_WEEKS_MIN,
} from 'utils/lib/types/api/birth-history.types';
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
  /** The fields to save; undefined while a value is one the server rejects (see invalidReason). */
  getValue: () => BirthHistory | undefined;
  /** Why the form can't be saved, for the Save button's hover; undefined when it can. */
  invalidReason: string | undefined;
  weeksInvalid: boolean;
  daysInvalid: boolean;
}

type Field = keyof BirthHistory;

/** The reason shown for the first field the server would reject. */
const REASONS: Record<Field, string> = {
  timeOfBirth: 'Enter a valid time of birth',
  gestationalAgeWeeks: `Enter gestational age weeks as a whole number from ${GESTATIONAL_AGE_WEEKS_MIN} to ${GESTATIONAL_AGE_WEEKS_MAX}`,
  gestationalAgeDays: 'Enter gestational age days as a whole number from 0 to 6',
  birthWeightKg: 'Enter the birth weight as a number above 0',
  birthLengthCm: 'Enter the birth length as a number above 0',
  birthHeadCircumferenceCm: 'Enter the birth head circumference as a number above 0',
};
const DAYS_NEED_WEEKS = 'Enter the weeks for the gestational age days';

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

  const weeksValue = weeks.trim() ? textToNumericValue(weeks) : undefined;
  const daysValue = days.trim() ? textToNumericValue(days) : undefined;
  const value: BirthHistory = {
    ...(timeOfBirth ? { timeOfBirth: timeOfBirth.isValid ? timeOfBirth.toFormat('HH:mm') : '' } : {}),
    ...(weeksValue !== undefined ? { gestationalAgeWeeks: weeksValue } : {}),
    ...(daysValue !== undefined ? { gestationalAgeDays: daysValue } : {}),
    ...(weight.value !== undefined ? { birthWeightKg: weight.value } : {}),
    ...(length.value !== undefined ? { birthLengthCm: length.value } : {}),
    ...(headCircumference.value !== undefined ? { birthHeadCircumferenceCm: headCircumference.value } : {}),
  };
  // Text that is not a number, then whatever the server's own schema rejects (BirthHistorySchema).
  const notNumbers: Record<Field, boolean> = {
    timeOfBirth: false,
    gestationalAgeWeeks: !!weeks.trim() && weeksValue === undefined,
    gestationalAgeDays: !!days.trim() && daysValue === undefined,
    birthWeightKg: weight.invalid,
    birthLengthCm: length.invalid,
    birthHeadCircumferenceCm: headCircumference.invalid,
  };
  const issues = BirthHistorySchema.safeParse(value).error?.issues ?? [];
  const daysNeedWeeks = issues.some((issue) => issue.code === 'custom');
  const invalid = new Set<Field>([
    ...(Object.keys(notNumbers) as Field[]).filter((field) => notNumbers[field]),
    ...issues.filter((issue) => issue.code !== 'custom').map((issue) => issue.path[0] as Field),
  ]);
  const firstInvalid = (Object.keys(REASONS) as Field[]).find((field) => invalid.has(field));
  const invalidReason = firstInvalid ? REASONS[firstInvalid] : daysNeedWeeks ? DAYS_NEED_WEEKS : undefined;
  const getValue = (): BirthHistory | undefined => (invalidReason ? undefined : value);

  return {
    timeOfBirth,
    setTimeOfBirth,
    weeks,
    days,
    setWeeks,
    setDays,
    weight,
    length,
    headCircumference,
    getValue,
    invalidReason,
    weeksInvalid: invalid.has('gestationalAgeWeeks'),
    daysInvalid: invalid.has('gestationalAgeDays'),
  };
};
