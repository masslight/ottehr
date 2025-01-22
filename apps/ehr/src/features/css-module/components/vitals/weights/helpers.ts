import {
  isWeightVitalObservation,
  VitalsObservationDTO,
  VitalsWeightObservationDTO,
  kgToLb,
  weightPercentile,
} from 'utils';
import { VitalWeightHistoryEntry } from './VitalWeightHistoryEntry';
import { composeVitalsHistoryEntries } from '../utils';

export const PERCENTILE_THRESHOLD = 3;
const checkIsPercentileWarning = (weightKg: number): boolean => {
  return weightPercentile(weightKg) > PERCENTILE_THRESHOLD;
};

export const composeWeightVitalsHistoryEntries = (
  encounterId: string,
  userId: string | undefined,
  vitalsEntitiesByEncounter: VitalsObservationDTO[],
  vitalsEntitiesByPatient: VitalsObservationDTO[]
): VitalWeightHistoryEntry[] => {
  const res = composeVitalsHistoryEntries<VitalsWeightObservationDTO, VitalWeightHistoryEntry>(
    encounterId,
    userId,
    vitalsEntitiesByEncounter,
    vitalsEntitiesByPatient,
    isWeightVitalObservation,
    (observation) => {
      return {
        weightKg: observation.value,
        weightLbs: kgToLb(observation.value),
        percentile: weightPercentile(observation.value),
        isPercentileWarning: checkIsPercentileWarning(observation.value),
      };
    }
  );

  return res;
};
