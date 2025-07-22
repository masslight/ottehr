import {
  VitalFieldNames,
  VitalsBloodPressureObservationDTO,
  VitalsHeartbeatObservationDTO,
  VitalsHeightObservationDTO,
  VitalsOxygenSatObservationDTO,
  VitalsRespirationRateObservationDTO,
  VitalsTemperatureObservationDTO,
  VitalsVisionObservationDTO,
  VitalsWeightObservationDTO,
} from '../..';

export type GetVitalsResponseData = {
  [VitalFieldNames.VitalTemperature]: VitalsTemperatureObservationDTO[];
  [VitalFieldNames.VitalHeartbeat]: VitalsHeartbeatObservationDTO[];
  [VitalFieldNames.VitalRespirationRate]: VitalsRespirationRateObservationDTO[];
  [VitalFieldNames.VitalBloodPressure]: VitalsBloodPressureObservationDTO[];
  [VitalFieldNames.VitalOxygenSaturation]: VitalsOxygenSatObservationDTO[];
  [VitalFieldNames.VitalWeight]: VitalsWeightObservationDTO[];
  [VitalFieldNames.VitalHeight]: VitalsHeightObservationDTO[];
  [VitalFieldNames.VitalVision]: VitalsVisionObservationDTO[];
};

export type GetVitalsRequestPayload = {
  encounterId: string;
  mode: 'current' | 'historical';
};
