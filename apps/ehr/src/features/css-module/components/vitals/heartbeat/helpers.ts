import { roundNumberToDecimalPlaces, textToNumericValue } from 'utils';

export const textToHeartbeatNumber = (text: string): number | undefined => {
  const hrVal = textToNumericValue(text);
  if (!hrVal) return;
  return roundNumberToDecimalPlaces(hrVal, 0);
};
