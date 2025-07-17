import { roundNumberToDecimalPlaces, textToNumericValue } from 'utils';

export const textToOxygenSatNumber = (text: string): number | undefined => {
  const oxySatVal = textToNumericValue(text);
  if (!oxySatVal) return;
  return roundNumberToDecimalPlaces(oxySatVal, 0);
};

/*
export const isValidOxySatPercentageValue = (oxySatPercentage: number): boolean => {
  return oxySatPercentage >= 80 && oxySatPercentage <= 100;
};

export const OXY_SAT_ABNORMAL_THRESHOLD = 94;
const checkIsOxySatAbnormal = (oxySatPercentage: number): boolean => {
  return oxySatPercentage < OXY_SAT_ABNORMAL_THRESHOLD;
};

export const OXY_SAT_CRITICAL_THRESHOLD = 92;
const checkIsOxySatCritical = (oxySatPercentage: number): boolean => {
  return oxySatPercentage < OXY_SAT_CRITICAL_THRESHOLD;
};

const getOxygenSatSeverity = (oxySatPercentage?: number): VitalsOxygenSatSeverity | undefined => {
  if (!oxySatPercentage) return;
  if (checkIsOxySatCritical(oxySatPercentage)) {
    return 'critical';
  }
  if (checkIsOxySatAbnormal(oxySatPercentage)) {
    return 'abnormal';
  }
  return undefined;
};
*/
