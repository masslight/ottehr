import { roundNumberToDecimalPlaces } from '../../utils/convert';
export const LBS_IN_KG = 2.20462;

export const kgToLbs = (kg: number): number => Math.round(kg * LBS_IN_KG * 100) / 100;

export function formatWeightKg(weightKg: number): string {
  return formatWeight(weightKg, 'kg');
}

export function formatWeightLbs(weightKg: number): string {
  return formatWeight(weightKg, 'lbs');
}

// 2 decimals for every patient, so an infant's 3.25 kg is not shown as 3.3.
export function formatWeight(weightKg: number, unit: 'kg' | 'lbs'): string {
  const weight = unit === 'kg' ? weightKg : weightKg * LBS_IN_KG;
  return roundNumberToDecimalPlaces(weight, 2).toString();
}
