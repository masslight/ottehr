import {
  isHeartbeatVitalObservation,
  roundNumberToDecimalPlaces,
  textToNumericValue,
  VitalsHeartbeatObservationDTO,
  VitalsObservationDTO,
} from 'utils';
import { composeVitalsHistoryEntries } from '../utils';
import { VitalHeartbeatHistoryEntry } from './VitalHeartbeatHistoryEntry';

export const textToHeartbeatNumber = (text: string): number | undefined => {
  const hrVal = textToNumericValue(text);
  if (!hrVal) return;
  return roundNumberToDecimalPlaces(hrVal, 0);
};

export const isValidHeartbeatPerMinValue = (heartbeatPerMin: number): boolean => {
  return heartbeatPerMin >= 40 && heartbeatPerMin <= 150;
};

export const HEARTBEAT_WARNING_THRESHOLD = 90;
const checkIsHeartbeatWarning = (heartbeatPerMin: number): boolean => {
  return heartbeatPerMin > HEARTBEAT_WARNING_THRESHOLD;
};

export const composeHeartbeatHistoryEntries = (
  encounterId: string,
  userId: string | undefined,
  vitalsEntitiesByEncounter: VitalsObservationDTO[],
  vitalsEntitiesByPatient: VitalsObservationDTO[]
): VitalHeartbeatHistoryEntry[] => {
  const res = composeVitalsHistoryEntries<VitalsHeartbeatObservationDTO, VitalHeartbeatHistoryEntry>(
    encounterId,
    userId,
    vitalsEntitiesByEncounter,
    vitalsEntitiesByPatient,
    isHeartbeatVitalObservation,
    (observation) => {
      return {
        heartbeatPerMin: observation.value,
        isHeartbeatWarning: checkIsHeartbeatWarning(observation.value),
      };
    }
  );

  return res;
};
