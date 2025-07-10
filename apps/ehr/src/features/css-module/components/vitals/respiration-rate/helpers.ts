import {
  isRespirationRateVitalObservation,
  roundNumberToDecimalPlaces,
  textToNumericValue,
  VitalsObservationDTO,
  VitalsRespirationRateObservationDTO,
} from 'utils';
import { composeVitalsHistoryEntries } from '../utils';
import { VitalsRespirationRateHistoryEntry, VitalsRespirationRateSeverity } from './VitalsRespirationRateHistoryEntry';

export const textToRespirationRateNumber = (text: string): number | undefined => {
  const respRateVal = textToNumericValue(text);
  if (!respRateVal) return;
  return roundNumberToDecimalPlaces(respRateVal, 0);
};

export const isValidRespirationRateValue = (rrPerMin: number): boolean => {
  return rrPerMin >= 8 && rrPerMin <= 25;
};

const checkIsRespirationRateNormal = (rrPerMin: number): boolean => {
  return rrPerMin >= 12 && rrPerMin < 16;
};

const getRespirationRateSeverity = (rrPerMin?: number): VitalsRespirationRateSeverity | undefined => {
  if (!rrPerMin) return;
  if (checkIsRespirationRateNormal(rrPerMin)) return;
  return 'abnormal';
};

export const composeRespirationRateHistoryEntries = (
  encounterId: string,
  userId: string | undefined,
  vitalsEntitiesByEncounter: VitalsObservationDTO[],
  vitalsEntitiesByPatient: VitalsObservationDTO[]
): VitalsRespirationRateHistoryEntry[] => {
  return composeVitalsHistoryEntries<VitalsRespirationRateObservationDTO, VitalsRespirationRateHistoryEntry>(
    encounterId,
    userId,
    vitalsEntitiesByEncounter,
    vitalsEntitiesByPatient,
    isRespirationRateVitalObservation,
    (observation) => {
      return {
        respirationsPerMin: observation.value,
        respirationRateSeverity: getRespirationRateSeverity(observation.value),
      };
    }
  );
};
