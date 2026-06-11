import { feetInchesToCm, inchesToCm, roundNumberToDecimalPlaces, textToNumericValue } from 'utils';

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

export const textToHeightNumberFromFeetAndInchRemainder = (
  feetText: string,
  inchRemainderText: string
): number | undefined => {
  const hasFeet = feetText.trim().length > 0;
  const hasInchRemainder = inchRemainderText.trim().length > 0;

  if (!hasFeet && !hasInchRemainder) return;

  const feet = hasFeet ? textToNumericValue(feetText) : 0;
  const inchRemainder = hasInchRemainder ? textToNumericValue(inchRemainderText) : 0;

  if (feet === undefined || inchRemainder === undefined) return;

  return roundHeightValue(feetInchesToCm(feet, inchRemainder));
};

const roundHeightValue = (heightVal: number): number => roundNumberToDecimalPlaces(heightVal, 1);
