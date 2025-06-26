import { VitalsVisionObservationDTO, VitalVisionExtraOption } from 'utils';
import { VitalHistoryEntry } from '../types';

export type VitalVisionHistoryEntry = {
  leftEyeVision?: string;
  rightEyeVision?: string;
  extraOptions?: VitalVisionExtraOption[];
} & VitalHistoryEntry<VitalsVisionObservationDTO>;
