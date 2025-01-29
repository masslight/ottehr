import { isWeightVitalObservation, VitalsObservationDTO, VitalsWeightObservationDTO, kgToLb } from 'utils';
import { VitalWeightHistoryEntry } from './VitalWeightHistoryEntry';
import { composeVitalsHistoryEntries } from '../utils';

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
      };
    }
  );

  return res;
};
