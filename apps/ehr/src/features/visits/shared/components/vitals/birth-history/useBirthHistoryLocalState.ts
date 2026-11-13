import { DateTime } from 'luxon';
import { ChangeEvent, useState } from 'react';
import { HEIGHT_CM_DISPLAY_PRECISION, HeightMeasurement } from 'utils/lib/helpers/vitals/vitals-height.helper';
import { LBS_IN_KG } from 'utils/lib/helpers/vitals/vitals-weight.helper';
import { BirthHistory } from 'utils/lib/types/api/birth-history.types';
import { roundNumberToDecimalPlaces, textToNumericValue } from 'utils/lib/utils/convert';

type Unit = 'metric' | 'imperial';
type InputChange = ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;

export interface PairedMeasureState {
  metricText: string;
  imperialText: string;
  handleMetricChange: (e: InputChange) => void;
  handleImperialChange: (e: InputChange) => void;
  /** The metric value to save; undefined when empty or not a number. */
  value: number | undefined;
}

/**
 * A metric/imperial input pair with one stored metric value: typing in either field fills the other, the field
 * being typed in keeps its raw text (as the head circumference card does), imperial is converted on entry.
 */
const usePairedMeasure = (
  initialMetric: number | undefined,
  toMetric: (imperial: number) => number,
  toImperial: (metric: number) => number,
  metricDigits: number
): PairedMeasureState => {
  const [metric, setMetric] = useState<number | undefined>(initialMetric);
  const [editing, setEditing] = useState<{ unit: Unit; text: string }>();
  const handle = (unit: Unit) => (e: InputChange) => {
    const text = e.target.value;
    setEditing({ unit, text });
    const typed = textToNumericValue(text);
    setMetric(typed === undefined ? undefined : unit === 'metric' ? typed : toMetric(typed));
  };
  const asText = (unit: Unit, derived: number | undefined): string =>
    editing?.unit === unit ? editing.text : derived === undefined ? '' : `${derived}`;
  return {
    metricText: asText('metric', metric === undefined ? undefined : roundNumberToDecimalPlaces(metric, metricDigits)),
    imperialText: asText('imperial', metric === undefined ? undefined : toImperial(metric)),
    handleMetricChange: handle('metric'),
    handleImperialChange: handle('imperial'),
    value: metric,
  };
};

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
