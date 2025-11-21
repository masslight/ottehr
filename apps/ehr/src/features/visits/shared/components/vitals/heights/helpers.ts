import {
  cmToFeetText,
  cmToInchesText,
  feetToCm,
  inchesToCm,
  roundNumberToDecimalPlaces,
  textToNumericValue,
} from 'utils';

export const textToHeightNumber = (text: string): number | undefined => {
  const heightVal = textToNumericValue(text);
  if (!heightVal) return;
  return roundHeightValue(heightVal);
};

export const textToHeightNumberFromInches = (inchesText: string): number | undefined => {
  const inches = textToNumericValue(inchesText);
  if (inches === undefined) return;
  return roundHeightValue(inchesToCm(inches));
};

export const textToHeightNumberFromFeet = (feetText: string): number | undefined => {
  const feet = textToNumericValue(feetText);
  if (feet === undefined) return;
  return roundHeightValue(feetToCm(feet));
};

export const heightCmToInchesText = (heightCm: number): string => {
  return cmToInchesText(heightCm);
};

export const heightCmToFeetText = (heightCm: number): string => {
  return cmToFeetText(heightCm);
};

const roundHeightValue = (heightVal: number): number => roundNumberToDecimalPlaces(heightVal, 1);
