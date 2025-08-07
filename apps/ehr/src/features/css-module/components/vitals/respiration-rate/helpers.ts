import { roundNumberToDecimalPlaces, textToNumericValue } from 'utils';

export const textToRespirationRateNumber = (text: string): number | undefined => {
  const respRateVal = textToNumericValue(text);
  if (!respRateVal) return;
  return roundNumberToDecimalPlaces(respRateVal, 0);
};
