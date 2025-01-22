import { roundNumberToDecimalPlaces, textToNumericValue } from '../../utils';

export const textToWeightNumber = (text: string): number | undefined => {
  const weightValue = textToNumericValue(text);
  if (!weightValue) return;
  return roundVitalWeightValue(weightValue);
};

export const kgToLb = (kg: number): number => roundVitalWeightValue(2.2 * kg);

const roundVitalWeightValue = (weight: number): number => roundNumberToDecimalPlaces(weight, 1);

export const weightPercentile = (kg: number): number => {
  if (kg < 45) {
    return 4;
  }
  if (kg > 90) {
    return 4;
  }

  const firstDigit = kg.toString()[0];
  const dummyPercentile = parseInt(firstDigit, 10) % 4;
  return Math.max(dummyPercentile, 1);
};
