import {
  isVisionVitalObservation,
  parseVisionExtraOptions,
  VitalsObservationDTO,
  VitalsVisionObservationDTO,
} from 'utils';
import { composeVitalsHistoryEntries } from '../utils';
import { VitalVisionHistoryEntry } from './VitalVisionEntry';

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
        leftEyeVision: observation.leftEyeVisionValue?.toString(),
        rightEyeVision: observation.rightEyeVisionValue?.toString(),
        extraOptions: parseVisionExtraOptions(observation.extraVisionOptions),
      };
    }
  );
};
