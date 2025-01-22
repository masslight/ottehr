import { VitalsBloodPressureObservationDTO } from 'utils';
import { VitalHistoryEntry } from '../types';

export type VitalsBloodPressureSeverity = 'abnormal' | 'critical';

export type VitalBloodPressureHistoryEntry = {
  systolicPressure: number;
  diastolicPressure: number;
  bloodPressureSeverity?: VitalsBloodPressureSeverity;
} & VitalHistoryEntry<VitalsBloodPressureObservationDTO>;
