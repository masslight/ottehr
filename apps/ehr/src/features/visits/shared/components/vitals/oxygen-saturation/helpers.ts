import { roundNumberToDecimalPlaces, textToNumericValue } from 'utils';

export const textToOxygenSatNumber = (text: string): number | undefined => {
  const oxySatVal = textToNumericValue(text);
  if (!oxySatVal) return;
  return roundNumberToDecimalPlaces(oxySatVal, 0);
};
