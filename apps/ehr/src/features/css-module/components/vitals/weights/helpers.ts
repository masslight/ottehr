import { isWeightVitalObservation, kgToLb, VitalsObservationDTO, VitalsWeightObservationDTO } from 'utils';
import { composeVitalsHistoryEntries } from '../utils';
import { VitalWeightHistoryEntry } from './VitalWeightHistoryEntry';

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
