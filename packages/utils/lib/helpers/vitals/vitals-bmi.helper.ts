import { DateTime } from 'luxon';
import { VitalFieldNames } from '../../types/api/chart-data/chart-data.constants';
import { VitalsObservationDTO } from '../../types/api/chart-data/chart-data.types';
import { roundNumberToDecimalPlaces } from '../../utils/convert';
import { ageInMonthsOnDate } from '../../utils/dateUtils';

export const BMI_DISPLAY_PRECISION = 1;
export const BMI_UNIT = 'kg/m2';

/**
 * Calculates BMI from weight in kg and height in cm.
 * Formula: weight_kg / (height_m)^2
 */
export const calculateBMI = (weightKg: number, heightCm: number): number => {
  const heightM = heightCm / 100;
  return roundNumberToDecimalPlaces(weightKg / (heightM * heightM), BMI_DISPLAY_PRECISION);
};

export const formatBMI = (bmi: number): string => bmi.toFixed(BMI_DISPLAY_PRECISION);

export const formatBMIWithUnit = (bmi: number): string => `${formatBMI(bmi)} ${BMI_UNIT}`;

/** True when both ISO timestamps fall on the same UTC calendar day (vital dates are stored in UTC). */
export const areVitalsSameDay = (isoA: string | undefined, isoB: string | undefined): boolean => {
  if (!isoA || !isoB) return false;
  return DateTime.fromISO(isoA, { zone: 'utc' }).hasSame(DateTime.fromISO(isoB, { zone: 'utc' }), 'day');
};

export const BMI_FROM_MONTHS = 24;

export const bmiAppliesAt = (ageMonths: number | undefined): boolean =>
  ageMonths === undefined || ageMonths >= BMI_FROM_MONTHS;

export const bmiAppliesOnDate = (birthDate: string | undefined, onDate: string | undefined): boolean =>
  bmiAppliesAt(ageInMonthsOnDate(birthDate, onDate));

// Without a visit date, each BMI is judged by the age at the reading's own date.
export const withoutBMIUnder24Months = <T extends VitalsObservationDTO>(
  vitals: T[],
  birthDate: string | undefined,
  visitStart?: string
): T[] =>
  vitals.filter(
    (vital) => vital.field !== VitalFieldNames.VitalBMI || bmiAppliesOnDate(birthDate, visitStart ?? vital.lastUpdated)
  );
