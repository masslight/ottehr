import { roundNumberToDecimalPlaces, textToNumericValue } from 'utils';

export const textToBloodPressureNumber = (text: string): number | undefined => {
  const bpVal = textToNumericValue(text);
  if (!bpVal) return;
  return roundPressureValue(bpVal);
};

const roundPressureValue = (bpVal: number): number => roundNumberToDecimalPlaces(bpVal, 0);
