import { VitalsHeartbeatObservationDTO } from 'utils';
import { VitalHistoryEntry } from '../types';

export type VitalHeartbeatHistoryEntry = {
  heartbeatPerMin: number;
  isHeartbeatWarning: boolean;
} & VitalHistoryEntry<VitalsHeartbeatObservationDTO>;
