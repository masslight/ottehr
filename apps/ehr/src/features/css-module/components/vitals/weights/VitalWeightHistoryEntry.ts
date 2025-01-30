import { VitalsWeightObservationDTO } from 'utils';
import { VitalHistoryEntry } from '../types';

export type VitalWeightHistoryEntry = {
  weightKg: number;
  weightLbs: number;
} & VitalHistoryEntry<VitalsWeightObservationDTO>;
