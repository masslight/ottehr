import { VitalsVisionObservationDTO, VitalVisionExtraOption, VitalVisionUnit } from 'utils';
import { VitalHistoryEntry } from '../types';

export type VitalVisionHistoryEntry = {
  leftEyeVision?: VitalVisionUnit;
  rightEyeVision?: VitalVisionUnit;
  extraOptions?: VitalVisionExtraOption[];
} & VitalHistoryEntry<VitalsVisionObservationDTO>;
