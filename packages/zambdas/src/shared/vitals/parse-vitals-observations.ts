import { SearchParam } from '@oystehr/sdk';
import { Observation, Practitioner } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { getFullName } from 'utils/lib/fhir/patient';
import {
  extractBloodPressureObservationMethod,
  extractDotVisionScreening,
  extractHeartbeatObservationMethod,
  extractOxySaturationObservationMethod,
  extractTemperatureObservationMethod,
  extractVisionValues,
  LOINC_SYSTEM,
  parseLastMenstrualPeriodObservation,
  VITAL_DIASTOLIC_BLOOD_PRESSURE_LOINC_CODE,
  VITAL_SYSTOLIC_BLOOD_PRESSURE_LOINC_CODE,
} from 'utils/lib/fhir/vitals';
import { getVitalDTOCriticalityFromObservation } from 'utils/lib/helpers/vitals/utils';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import {
  PATIENT_VITALS_META_SYSTEM,
  VitalsBloodPressureObservationDTO,
  VitalsHeartbeatObservationDTO,
  VitalsObservationDTO,
  VitalsOxygenSatObservationDTO,
  VitalsTemperatureObservationDTO,
  VitalsVisionObservationDTO,
} from 'utils/lib/types/api/chart-data/chart-data.types';
import * as z from 'zod';
import { resolveVitalAlertCriticality, VitalAlertContext } from '../vitals-alert-config';

/**
 * Search parameters for the vitals Observations of a set of encounters, shared by
 * get-vitals-for-list-of-encounters and the tracking board so both read the same resources.
 * Performers are included because every DTO carries the author's name.
 */
export const VITALS_ENCOUNTER_CHUNK_SIZE = 25;

export const vitalsObservationSearchParams = (encounterIds: string[]): SearchParam[] => [
  { name: 'encounter', value: encounterIds.map((id) => `Encounter/${id}`).join(',') },
  { name: 'status:not', value: 'entered-in-error,cancelled,unknown,cannot-be-obtained' },
  { name: '_tag', value: `${PRIVATE_EXTENSION_BASE_URL}/${PATIENT_VITALS_META_SYSTEM}|` },
  { name: '_include', value: 'Observation:performer' },
  { name: '_sort', value: '-date' }, // Sort by date descending
  { name: '_count', value: '1000' },
];

const fieldNameSchema = z.nativeEnum(VitalFieldNames);

/**
 * Converts vitals Observations into their DTOs. Only observations whose performer Practitioner is present
 * are returned, since every DTO names its author.
 *
 * With an `alertContext`, criticality is evaluated against the admin-configured thresholds; without one
 * it falls back to the `interpretation` stored on the observation at save time.
 */
export const parseVitalsObservationsToDTOs = (
  observations: Observation[],
  practitioners: Practitioner[],
  alertContext: VitalAlertContext | undefined
): VitalsObservationDTO[] => {
  const observationPerformerMap = new Map<string, Practitioner>();
  observations.forEach((obs) => {
    const performer = practitioners.find(
      (tempPractitioner) =>
        obs.performer?.some((p) => p.reference?.replace('Practitioner/', '') === tempPractitioner.id)
    );
    if (performer && obs.id) {
      observationPerformerMap.set(obs.id, performer);
    }
  });

  const vitalsDTOs: VitalsObservationDTO[] = Array.from(observationPerformerMap.entries()).flatMap(
    ([obsId, performer]) => {
      const observation = observations.find((obs) => obs.id === obsId);
      if (!observation || !observation.id) return [];
      // todo: don't base this on meta tag, but on the observation code
      const fieldCode = observation?.meta?.tag?.find(
        (tag) => tag.system === `${PRIVATE_EXTENSION_BASE_URL}/${PATIENT_VITALS_META_SYSTEM}`
      )?.code;

      if (!fieldCode) return [];

      const parsedField = fieldNameSchema.safeParse(fieldCode);
      if (!parsedField.success) return [];

      const field = parsedField.data;

      let vitalObservation: VitalsObservationDTO | undefined = undefined;

      if (field === VitalFieldNames.VitalBloodPressure) {
        vitalObservation = parseBloodPressureObservation(observation, performer);
      } else if (field === VitalFieldNames.VitalVision) {
        vitalObservation = parseVisionObservation(observation, performer);
      } else if (field === VitalFieldNames.VitalLastMenstrualPeriod) {
        vitalObservation = parseLastMenstrualPeriodObservation(observation, performer);
      } else {
        vitalObservation = parseNumericValueObservation(observation, performer, field);
      }

      if (vitalObservation) {
        vitalObservation.alertCriticality = alertContext
          ? resolveVitalAlertCriticality(observation, vitalObservation, alertContext)
          : getVitalDTOCriticalityFromObservation(observation);
        return vitalObservation;
      }
      return [];
    }
  );
  return vitalsDTOs;
};

const parseBloodPressureObservation = (
  observation: Observation,
  performer: Practitioner
): VitalsBloodPressureObservationDTO | undefined => {
  const systolicBP = observation.component?.find(
    (comp) =>
      comp.code?.coding?.some(
        (cc) => cc.code === VITAL_SYSTOLIC_BLOOD_PRESSURE_LOINC_CODE && cc.system === LOINC_SYSTEM
      )
  )?.valueQuantity?.value;
  const diastolicBP = observation.component?.find(
    (comp) =>
      comp.code?.coding?.some(
        (cc) => cc.code === VITAL_DIASTOLIC_BLOOD_PRESSURE_LOINC_CODE && cc.system === LOINC_SYSTEM
      )
  )?.valueQuantity?.value;
  if (systolicBP === undefined || diastolicBP === undefined) return undefined;
  return {
    resourceId: observation.id,
    field: VitalFieldNames.VitalBloodPressure,
    systolicPressure: systolicBP,
    diastolicPressure: diastolicBP,
    authorId: performer.id,
    authorName: getFullName(performer),
    observationMethod: extractBloodPressureObservationMethod(observation),
    lastUpdated: observation.effectiveDateTime || '',
  };
};

const parseVisionObservation = (
  observation: Observation,
  performer: Practitioner
): VitalsVisionObservationDTO | undefined => {
  // Check if the observation has the correct field code
  const fieldCode = observation?.meta?.tag?.find(
    (tag) => tag.system === `${PRIVATE_EXTENSION_BASE_URL}/${PATIENT_VITALS_META_SYSTEM}`
  )?.code;

  if (fieldCode !== VitalFieldNames.VitalVision) return undefined;

  const components = observation.component || [];

  const {
    leftEyeVisText: leftEyeVisionText,
    rightEyeVisText: rightEyeVisionText,
    bothEyesVisText: bothEyesVisionText,
    visionOptions,
  } = extractVisionValues(components);

  const dotVisionScreening = extractDotVisionScreening(components, observation.derivedFrom);

  if (
    leftEyeVisionText === undefined &&
    rightEyeVisionText === undefined &&
    bothEyesVisionText === undefined &&
    dotVisionScreening === undefined
  ) {
    return undefined;
  }

  return {
    resourceId: observation.id,
    field: VitalFieldNames.VitalVision,
    leftEyeVisionText: leftEyeVisionText ?? '',
    rightEyeVisionText: rightEyeVisionText ?? '',
    bothEyesVisionText,
    authorId: performer.id,
    authorName: getFullName(performer),
    lastUpdated: observation.effectiveDateTime || '',
    extraVisionOptions: visionOptions,
    dotVisionScreening,
  };
};

type AllOtherFields =
  | VitalFieldNames.VitalHeartbeat
  | VitalFieldNames.VitalOxygenSaturation
  | VitalFieldNames.VitalTemperature
  | VitalFieldNames.VitalRespirationRate
  | VitalFieldNames.VitalHeight
  | VitalFieldNames.VitalWeight
  | VitalFieldNames.VitalBMI;

const parseNumericValueObservation = (
  observation: Observation,
  performer: Practitioner,
  field: AllOtherFields
): VitalsObservationDTO | undefined => {
  const value = observation.valueQuantity?.value;
  if (value === undefined) return undefined;
  const baseFields = {
    resourceId: observation.id,
    field,
    value,
    authorId: performer.id,
    authorName: getFullName(performer),
    lastUpdated: observation.effectiveDateTime || '',
  };
  if (field === VitalFieldNames.VitalOxygenSaturation) {
    return {
      ...baseFields,
      observationMethod: extractOxySaturationObservationMethod(observation),
    } as VitalsOxygenSatObservationDTO;
  }
  if (field === VitalFieldNames.VitalHeartbeat) {
    return {
      ...baseFields,
      observationMethod: extractHeartbeatObservationMethod(observation),
    } as VitalsHeartbeatObservationDTO;
  }
  if (field === VitalFieldNames.VitalTemperature) {
    return {
      ...baseFields,
      observationMethod: extractTemperatureObservationMethod(observation),
    } as VitalsTemperatureObservationDTO;
  }
  return baseFields;
};
