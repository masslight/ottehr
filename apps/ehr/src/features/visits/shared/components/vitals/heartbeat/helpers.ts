import { roundNumberToDecimalPlaces, textToNumericValue } from 'utils/lib/utils/convert';

export const textToHeartbeatNumber = (text: string): number | undefined => {
  const hrVal = textToNumericValue(text);
  if (hrVal === undefined) return;
  return roundNumberToDecimalPlaces(hrVal, 0);
};
