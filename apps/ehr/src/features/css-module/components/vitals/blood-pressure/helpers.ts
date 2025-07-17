import { roundNumberToDecimalPlaces, textToNumericValue } from 'utils';

export const textToBloodPressureNumber = (text: string): number | undefined => {
  const bpVal = textToNumericValue(text);
  if (!bpVal) return;
  return roundPressureValue(bpVal);
};

const roundPressureValue = (bpVal: number): number => roundNumberToDecimalPlaces(bpVal, 0);

/*
export const composeBloodPressureVitalsHistoryEntries = (
  encounterId: string,
  userId: string | undefined,
  vitalsEntitiesByEncounter: VitalsObservationDTO[],
  vitalsEntitiesByPatient: VitalsObservationDTO[]
): VitalBloodPressureHistoryEntry[] => {
  return composeVitalsHistoryEntries<VitalsBloodPressureObservationDTO, VitalBloodPressureHistoryEntry>(
    encounterId,
    userId,
    vitalsEntitiesByEncounter,
    vitalsEntitiesByPatient,
    isBloodPressureVitalObservation,
    (observation) => {
      return {
        systolicPressure: observation.systolicPressure,
        diastolicPressure: observation.diastolicPressure,
        bloodPressureSeverity: getBloodPressureSeverity(observation.systolicPressure, observation.diastolicPressure),
      };
    }
  );
};
*/
