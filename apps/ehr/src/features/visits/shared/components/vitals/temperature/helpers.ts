import { roundTemperatureForSave } from 'utils/lib/helpers/vitals/vitals-temperature.helper';
import { textToNumericValue } from 'utils/lib/utils/convert';

export const textToTemperatureNumber = (text: string): number | undefined => {
  const tempVal = textToNumericValue(text);
  if (tempVal === undefined) return;
  return roundTemperatureForSave(tempVal);
};
