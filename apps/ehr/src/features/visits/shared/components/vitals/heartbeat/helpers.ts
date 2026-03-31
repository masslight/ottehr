import { roundNumberToDecimalPlaces, textToNumericValue } from 'utils';

export const textToHeartbeatNumber = (text: string): number | undefined => {
  const hrVal = textToNumericValue(text);
  if (hrVal === undefined) return;
  return roundNumberToDecimalPlaces(hrVal, 0);
};
