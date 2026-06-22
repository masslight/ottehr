import {
  VitalFieldNames,
  VitalsBloodPressureObservationDTO,
  VitalsHeartbeatObservationDTO,
  VitalsHeightObservationDTO,
  VitalsLastMenstrualPeriodObservationDTO,
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
  [VitalFieldNames.VitalLastMenstrualPeriod]: VitalsLastMenstrualPeriodObservationDTO[];
};

export type GetVitalsRequestPayload = {
  encounterId: string;
  // NB: this field is intentionally named `currentOrHistorical` rather than `mode`. The Oystehr
  // SDK treats a `mode` key on a zambda.execute payload as a reserved request-context option
  // (FhirResponseMode), which causes it to drop the real payload and send an empty path param.
  currentOrHistorical: 'current' | 'historical';
};

export type GetVitalsForListOfEncountersRequestPayload = {
  encounterIds: string[];
};

export type GetVitalsForListOfEncountersResponseData = {
  [encounterId: string]: GetVitalsResponseData;
};
