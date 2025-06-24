import {
  isOxygenSaturationVitalObservation,
  roundNumberToDecimalPlaces,
  textToNumericValue,
  VitalsObservationDTO,
  VitalsOxygenSatObservationDTO,
} from 'utils';
import { composeVitalsHistoryEntries } from '../utils';
import { VitalsOxygenSatHistoryEntry, VitalsOxygenSatSeverity } from './VitalsOxygenSatHistoryEntry';

export const textToOxygenSatNumber = (text: string): number | undefined => {
  const oxySatVal = textToNumericValue(text);
  if (!oxySatVal) return;
  return roundNumberToDecimalPlaces(oxySatVal, 0);
};

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

export const composeOxygenSatHistoryEntries = (
  encounterId: string,
  userId: string | undefined,
  vitalsEntitiesByEncounter: VitalsObservationDTO[],
  vitalsEntitiesByPatient: VitalsObservationDTO[]
): VitalsOxygenSatHistoryEntry[] => {
  const res = composeVitalsHistoryEntries<VitalsOxygenSatObservationDTO, VitalsOxygenSatHistoryEntry>(
    encounterId,
    userId,
    vitalsEntitiesByEncounter,
    vitalsEntitiesByPatient,
    isOxygenSaturationVitalObservation,
    (observation) => {
      return {
        oxygenSatPercentage: observation.value,
        oxygenSatSeverity: getOxygenSatSeverity(observation.value),
      };
    }
  );

  return res;
};
