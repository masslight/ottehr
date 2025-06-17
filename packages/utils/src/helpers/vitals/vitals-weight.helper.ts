import { roundNumberToDecimalPlaces, textToNumericValue } from '../../utils';

export const textToWeightNumber = (text: string): number | undefined => {
  const weightValue = textToNumericValue(text);
  if (!weightValue) return;
  return roundVitalWeightValue(weightValue);
};

export const kgToLb = (kg: number): number => roundVitalWeightValue(2.2 * kg);

const roundVitalWeightValue = (weight: number): number => roundNumberToDecimalPlaces(weight, 1);
