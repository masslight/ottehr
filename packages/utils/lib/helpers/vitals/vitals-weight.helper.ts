import { roundNumberToDecimalPlaces, textToNumericValue } from '../../utils';

export const textToWeightNumber = (text: string): number | undefined => {
  const weightValue = textToNumericValue(text);
  if (!weightValue) return;
  return roundVitalWeightValue(weightValue);
};

export const kgToLbs = (kg: number): number => Math.round(kg * 2.20462 * 10) / 10;

const roundVitalWeightValue = (weight: number): number => roundNumberToDecimalPlaces(weight, 1);
