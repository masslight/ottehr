import { roundNumberToDecimalPlaces } from '../../utils';

export const LBS_IN_KG = 2.20462;

export const kgToLbs = (kg: number): number => Math.round(kg * LBS_IN_KG * 10) / 10;

export function formatWeightKg(weightKg: number): string {
  return roundNumberToDecimalPlaces(weightKg, 1).toString();
}

export function formatWeightLbs(weightKg: number): string {
  return roundNumberToDecimalPlaces(weightKg * LBS_IN_KG, 1).toString();
}
