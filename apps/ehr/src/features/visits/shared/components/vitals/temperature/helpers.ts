import { roundTemperatureValue, textToNumericValue } from 'utils';

export const textToTemperatureNumber = (text: string): number | undefined => {
  const tempVal = textToNumericValue(text);
  if (!tempVal) return;
  return roundTemperatureValue(tempVal);
};
