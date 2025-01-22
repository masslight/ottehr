import { VitalsHeightObservationDTO } from 'utils';
import { VitalHistoryEntry } from '../types';

export type VitalHeightHistoryEntry = {
  heightCm: number;
  heightInch: number;
  isHeightWarning: boolean;
} & VitalHistoryEntry<VitalsHeightObservationDTO>;
