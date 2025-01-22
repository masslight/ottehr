import { VitalsRespirationRateObservationDTO } from 'utils';
import { VitalHistoryEntry } from '../types';

export type VitalsRespirationRateSeverity = 'abnormal';

export type VitalsRespirationRateHistoryEntry = {
  respirationsPerMin: number;
  respirationRateSeverity?: VitalsRespirationRateSeverity;
} & VitalHistoryEntry<VitalsRespirationRateObservationDTO>;
