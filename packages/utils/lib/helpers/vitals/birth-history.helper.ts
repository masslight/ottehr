import { DateTime } from 'luxon';
import { BirthHistory } from '../../types/api/birth-history.types';
import { roundNumberToDecimalPlaces } from '../../utils/convert';
import { vitalsConfig } from './config-schema';
import { formatHeadCircumferenceObservationValue } from './vitals-head-circumference.helper';
import { formatWeightKg, formatWeightLbs } from './vitals-weight.helper';

export const DAYS_PER_WEEK = 7;

/** Gestational age at birth in days; undefined until the weeks are recorded. */
export const gestationalAgeDaysOf = (history: BirthHistory | undefined): number | undefined =>
  history?.gestationalAgeWeeks === undefined
    ? undefined
    : history.gestationalAgeWeeks * DAYS_PER_WEEK + (history.gestationalAgeDays ?? 0);

/** "34 wk 5 d", "38 wk"; undefined without weeks. */
export const formatGestationalAge = (weeks?: number, days?: number): string | undefined =>
  weeks === undefined ? undefined : `${weeks} wk${days ? ` ${days} d` : ''}`;

/** "03:42 AM" from the stored 24-hour "HH:mm"; the time is a clock time, so no zone applies. */
export const formatTimeOfBirth = (timeOfBirth: string): string =>
  DateTime.fromFormat(timeOfBirth, 'HH:mm').toFormat('hh:mm a');

/** Both units, in the practice's weight unit order ("2.41 kg ≈ 5.31 lbs"). */
export const formatBirthWeight = (kg: number): string => {
  const kgText = `${formatWeightKg(kg)} kg`;
  const lbsText = `${formatWeightLbs(kg)} lbs`;
  return vitalsConfig['vital-weight'].unit === 'kg' ? `${kgText} ≈ ${lbsText}` : `${lbsText} ≈ ${kgText}`;
};

/** The collapsed card's one-line summary: "34 wk 5 d · born 03:42 AM · 2.41 kg · 46.0 cm · HC 32.0 cm". */
export const formatBirthHistorySummary = (history: BirthHistory): string =>
  [
    formatGestationalAge(history.gestationalAgeWeeks, history.gestationalAgeDays),
    history.timeOfBirth && `born ${formatTimeOfBirth(history.timeOfBirth)}`,
    history.birthWeightKg !== undefined && `${formatWeightKg(history.birthWeightKg)} kg`,
    history.birthLengthCm !== undefined && `${roundNumberToDecimalPlaces(history.birthLengthCm, 1).toFixed(1)} cm`,
    history.birthHeadCircumferenceCm !== undefined &&
      `HC ${roundNumberToDecimalPlaces(history.birthHeadCircumferenceCm, 1).toFixed(1)} cm`,
  ]
    .filter((part): part is string => !!part)
    .join(' · ');

/** The visit note's lines, each field in both units like the vitals ("Birth weight: 2.41 kg ≈ 5.31 lbs"). */
export const formatBirthHistoryNoteLines = (history: BirthHistory): string[] =>
  [
    history.timeOfBirth && `Time of birth: ${formatTimeOfBirth(history.timeOfBirth)}`,
    history.gestationalAgeWeeks !== undefined &&
      `Gestational age: ${formatGestationalAge(history.gestationalAgeWeeks, history.gestationalAgeDays)}`,
    history.birthWeightKg !== undefined && `Birth weight: ${formatBirthWeight(history.birthWeightKg)}`,
    history.birthLengthCm !== undefined &&
      `Birth length: ${formatHeadCircumferenceObservationValue(history.birthLengthCm)}`,
    history.birthHeadCircumferenceCm !== undefined &&
      `Birth head circumference: ${formatHeadCircumferenceObservationValue(history.birthHeadCircumferenceCm)}`,
  ].filter((line): line is string => !!line);
