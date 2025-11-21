import { roundNumberToDecimalPlaces } from '../../utils';

export const cmToInches = (heightCm: number): number => roundNumberToDecimalPlaces(0.393701 * heightCm, 1);

export const inchesToCm = (heightInches: number): number => roundNumberToDecimalPlaces(heightInches / 0.393701, 1);

export const cmToFeet = (heightCm: number): number => roundNumberToDecimalPlaces(heightCm / 30.48, 1);

export const cmToInchesText = (heightCm: number): string => {
  const inches = cmToInches(heightCm);
  return inches.toString();
};

export const feetToCm = (feet: number): number => {
  const totalInches = feet * 12;
  return inchesToCm(totalInches);
};

export const cmToFeetText = (heightCm: number): string => {
  const feet = cmToFeet(heightCm);
  return feet.toString();
};
