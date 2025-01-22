import { VitalsTemperatureObservationDTO } from 'utils';
import { VitalHistoryEntry } from '../types';

export type VitalTemperatureHistoryEntry = {
  temperatureCelsius: number;
  isTemperatureWarning: boolean;
} & VitalHistoryEntry<VitalsTemperatureObservationDTO>;
