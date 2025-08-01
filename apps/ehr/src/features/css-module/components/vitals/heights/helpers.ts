import { roundNumberToDecimalPlaces, textToNumericValue } from 'utils';

export const textToHeightNumber = (text: string): number | undefined => {
  const heightVal = textToNumericValue(text);
  if (!heightVal) return;
  return roundHeightValue(heightVal);
};

const roundHeightValue = (heightVal: number): number => roundNumberToDecimalPlaces(heightVal, 1);
