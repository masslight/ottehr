import {
  heightInCmToInch,
  isHeightVitalObservation,
  roundNumberToDecimalPlaces,
  textToNumericValue,
  VitalsHeightObservationDTO,
  VitalsObservationDTO,
} from 'utils';
import { composeVitalsHistoryEntries } from '../utils';
import { VitalHeightHistoryEntry } from './VitalHeightHistoryEntry';

export const textToHeightNumber = (text: string): number | undefined => {
  const heightVal = textToNumericValue(text);
  if (!heightVal) return;
  return roundHeightValue(heightVal);
};

const roundHeightValue = (heightVal: number): number => roundNumberToDecimalPlaces(heightVal, 1);

export const isValidHeightInCmValue = (heightCm: number): boolean => {
  return heightCm >= 100 && heightCm <= 250;
};

const checkIsHeightWarning = (heightCm: number): boolean => {
  return heightCm >= 250;
};

export const composeHeightVitalsHistoryEntries = (
  encounterId: string,
  userId: string | undefined,
  vitalsEntitiesByEncounter: VitalsObservationDTO[],
  vitalsEntitiesByPatient: VitalsObservationDTO[]
): VitalHeightHistoryEntry[] => {
  return composeVitalsHistoryEntries<VitalsHeightObservationDTO, VitalHeightHistoryEntry>(
    encounterId,
    userId,
    vitalsEntitiesByEncounter,
    vitalsEntitiesByPatient,
    isHeightVitalObservation,
    (observation) => {
      return {
        heightCm: observation.value,
        heightInch: heightInCmToInch(observation.value),
        isHeightWarning: checkIsHeightWarning(observation.value),
      };
    }
  );
};
