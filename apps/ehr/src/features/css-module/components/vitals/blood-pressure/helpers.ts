import {
  isBloodPressureVitalObservation,
  roundNumberToDecimalPlaces,
  textToNumericValue,
  VitalsBloodPressureObservationDTO,
  VitalsObservationDTO,
} from 'utils';
import { composeVitalsHistoryEntries } from '../utils';
import { VitalBloodPressureHistoryEntry, VitalsBloodPressureSeverity } from './VitalBloodPressureHistoryEntry';

export const textToBloodPressureNumber = (text: string): number | undefined => {
  const bpVal = textToNumericValue(text);
  if (!bpVal) return;
  return roundPressureValue(bpVal);
};

const roundPressureValue = (bpVal: number): number => roundNumberToDecimalPlaces(bpVal, 0);

export const isValidSystolicPressure = (systolicPressure: number): boolean => {
  return systolicPressure >= 90 && systolicPressure <= 230;
};

export const isValidDiastolicPressure = (systolicPressure: number): boolean => {
  return systolicPressure >= 40 && systolicPressure <= 140;
};

const checkIsBloodPressureAbnormal = (systolicPressure: number, diastolicPressure: number): boolean => {
  return systolicPressure > 180 || diastolicPressure < 70;
};

const checkIsBloodPressureCritical = (systolicPressure: number, diastolicPressure: number): boolean => {
  return systolicPressure > 180 || diastolicPressure < 70;
};

const getBloodPressureSeverity = (
  systolicPressure?: number,
  diastolicPressure?: number
): VitalsBloodPressureSeverity | undefined => {
  if (!systolicPressure) return;
  if (!diastolicPressure) return;
  if (checkIsBloodPressureCritical(systolicPressure, diastolicPressure)) {
    return 'critical';
  }
  if (checkIsBloodPressureAbnormal(systolicPressure, diastolicPressure)) {
    return 'abnormal';
  }
  return undefined;
};

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
