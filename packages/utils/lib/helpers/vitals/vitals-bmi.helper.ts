import { roundNumberToDecimalPlaces } from '../../utils';

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
