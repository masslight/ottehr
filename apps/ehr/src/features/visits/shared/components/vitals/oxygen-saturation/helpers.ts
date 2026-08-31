import { roundNumberToDecimalPlaces, textToNumericValue } from 'utils/lib/utils/convert';

export const textToOxygenSatNumber = (text: string): number | undefined => {
  const oxySatVal = textToNumericValue(text);
  if (oxySatVal === undefined) return;
  return roundNumberToDecimalPlaces(oxySatVal, 0);
};
