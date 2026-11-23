import { roundNumberToDecimalPlaces } from '../../utils/convert';
export const LBS_IN_KG = 2.20462;

export const WEIGHT_DISPLAY_PRECISION = 2;
export const WEIGHT_KG_SAVE_PRECISION = 3;

export const kgToLbs = (kg: number): number => roundNumberToDecimalPlaces(kg * LBS_IN_KG, WEIGHT_DISPLAY_PRECISION);

export const lbsToKg = (lbs: number): number => roundNumberToDecimalPlaces(lbs / LBS_IN_KG, WEIGHT_KG_SAVE_PRECISION);

export const roundWeightKg = (kg: number): number => roundNumberToDecimalPlaces(kg, WEIGHT_DISPLAY_PRECISION);

export function formatWeightKg(weightKg: number): string {
  return formatWeight(weightKg, 'kg');
}

export function formatWeightLbs(weightKg: number): string {
  return formatWeight(weightKg, 'lbs');
}

export function formatWeight(weightKg: number, unit: 'kg' | 'lbs'): string {
  return (unit === 'kg' ? roundWeightKg(weightKg) : kgToLbs(weightKg)).toString();
}
