import { VitalsOxygenSatObservationDTO } from 'utils';
import { VitalHistoryEntry } from '../types';

export type VitalsOxygenSatSeverity = 'abnormal' | 'critical';

export type VitalsOxygenSatHistoryEntry = {
  oxygenSatPercentage: number;
  oxygenSatSeverity?: VitalsOxygenSatSeverity;
} & VitalHistoryEntry<VitalsOxygenSatObservationDTO>;
