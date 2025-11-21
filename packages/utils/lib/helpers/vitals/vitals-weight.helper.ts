import { roundNumberToDecimalPlaces } from '../../utils';

export const LBS_IN_KG = 2.20462;

export const kgToLbs = (kg: number): number => Math.round(kg * LBS_IN_KG * 10) / 10;

export function formatWeightKg(weightKg: number): string {
  return formatWeight(weightKg, 'kg');
}

export function formatWeightLbs(weightKg: number): string {
  return formatWeight(weightKg, 'lbs');
}

export function formatWeight(weightKg: number, unit: 'kg' | 'lbs'): string {
  const weight = unit === 'kg' ? weightKg : weightKg * LBS_IN_KG;
  return roundNumberToDecimalPlaces(weight, 1).toString();
}
