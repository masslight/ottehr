import {
  isVisionVitalObservation,
  parseVisionExtraOptions,
  parseVisionValue,
  VitalsObservationDTO,
  VitalsVisionObservationDTO,
} from 'utils';
import { VitalVisionHistoryEntry } from './VitalVisionEntry';
import { composeVitalsHistoryEntries } from '../utils';

export const composeVisionVitalsHistoryEntries = (
  encounterId: string,
  userId: string | undefined,
  vitalsEntitiesByEncounter: VitalsObservationDTO[],
  vitalsEntitiesByPatient: VitalsObservationDTO[]
): VitalVisionHistoryEntry[] => {
  return composeVitalsHistoryEntries<VitalsVisionObservationDTO, VitalVisionHistoryEntry>(
    encounterId,
    userId,
    vitalsEntitiesByEncounter,
    vitalsEntitiesByPatient,
    isVisionVitalObservation,
    (observation) => {
      return {
        leftEyeVision: parseVisionValue(observation.leftEyeVisionValue),
        rightEyeVision: parseVisionValue(observation.rightEyeVisionValue),
        extraOptions: parseVisionExtraOptions(observation.extraVisionOptions),
      };
    }
  );
};
