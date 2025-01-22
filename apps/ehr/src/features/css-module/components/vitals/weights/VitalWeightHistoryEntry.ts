import { VitalsWeightObservationDTO } from 'utils';
import { VitalHistoryEntry } from '../types';

export type VitalWeightHistoryEntry = {
  weightKg: number;
  weightLbs: number;
  percentile: number;
  isPercentileWarning: boolean;
} & VitalHistoryEntry<VitalsWeightObservationDTO>;
