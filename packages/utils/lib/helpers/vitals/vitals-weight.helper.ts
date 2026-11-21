import { roundNumberToDecimalPlaces } from '../../utils/convert';
export const LBS_IN_KG = 2.20462;

export const kgToLbs = (kg: number): number => Math.round(kg * LBS_IN_KG * 10) / 10;

export function formatWeightKg(weightKg: number): string {
  return formatWeight(weightKg, 'kg');
}

export function formatWeightLbs(weightKg: number): string {
  return formatWeight(weightKg, 'lbs');
}

export const WEIGHT_DISPLAY_PRECISION = 2;
export const WEIGHT_KG_SAVE_PRECISION = 3;

export const lbsToKg = (lbs: number): number => roundNumberToDecimalPlaces(lbs / LBS_IN_KG, WEIGHT_KG_SAVE_PRECISION);

export function formatWeight(weightKg: number, unit: 'kg' | 'lbs'): string {
  const weight = unit === 'kg' ? weightKg : weightKg * LBS_IN_KG;
  return roundNumberToDecimalPlaces(weight, WEIGHT_DISPLAY_PRECISION).toString();
}
