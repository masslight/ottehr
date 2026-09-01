import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Observation, Patient, Practitioner } from 'fhir/r4b';
import { chunkThings } from 'utils/lib/fhir/chat';
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
import { convertVitalsListToMap, getVitalDTOCriticalityFromObservation } from 'utils/lib/helpers/vitals/utils';
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
import {
  GetVitalsForListOfEncountersRequestPayload,
  GetVitalsForListOfEncountersResponseData,
} from 'utils/lib/types/api/chart-data/get-vitals.types';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { isValidUUID } from 'utils/lib/validation/helper';
import * as z from 'zod';
import { checkOrCreateM2MClientToken } from '../../../../shared/auth';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import { wrapHandler } from '../../../../shared/sentry';
import { ZambdaInput } from '../../../../shared/types/common';

let m2mToken: string;
const ZAMBDA_NAME = 'get-vitals-for-list-of-encounters';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Validating input: ${JSON.stringify(input.body)}`);
  const { encounterIds, secrets } = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  console.log(`Performing complex validation for encounterId: ${encounterIds}`);
  const effectInput = await complexValidation({ encounterIds, secrets }, oystehr);
  console.log(`Effect input: ${JSON.stringify(effectInput)}`);
  const results = await performEffect(effectInput, oystehr);

  return {
    body: JSON.stringify(results),
    statusCode: 200,
  };
});

const performEffect = async (
  input: EffectInput,
  oystehr: Oystehr
): Promise<GetVitalsForListOfEncountersResponseData> => {
  const { encounters } = input;

  const { observationsByEncounter, practitioners } = await fetchVitalsForEncounters(
    encounters.map((encounter) => encounter.id),
    oystehr
  );

  // Every requested encounter appears in the response, with or without vitals — same as when this
  // built the map one encounter at a time.
  const encountersVitalsMap: GetVitalsForListOfEncountersResponseData = {};
  encounters.forEach((encounter) => {
    const observations = observationsByEncounter.get(`Encounter/${encounter.id}`) ?? [];
    encountersVitalsMap[encounter.id] = convertVitalsListToMap(parseResourcesToDTOs(observations, practitioners));
  });

  return encountersVitalsMap;
};

const VITALS_ENCOUNTER_CHUNK_SIZE = 25;

const fetchVitalsForEncounters = async (
  encounterIds: string[],
  oystehr: Oystehr
): Promise<{ observationsByEncounter: Map<string, Observation[]>; practitioners: Practitioner[] }> => {
  const bundles = await Promise.all(
    chunkThings(encounterIds, VITALS_ENCOUNTER_CHUNK_SIZE).map((encounterIdChunk) =>
      // Paged, so a chunk whose encounters carry an unusual number of vitals cannot be silently
      // truncated the way an unbounded single-page search could be.
      oystehr.fhir.searchAndGetAllPages<Observation | Practitioner>({
        resourceType: 'Observation',
        params: [
          { name: 'encounter', value: encounterIdChunk.map((id) => `Encounter/${id}`).join(',') },
          { name: 'status:not', value: 'entered-in-error,cancelled,unknown,cannot-be-obtained' },
          { name: '_tag', value: `${PRIVATE_EXTENSION_BASE_URL}/${PATIENT_VITALS_META_SYSTEM}|` },
          { name: '_include', value: 'Observation:performer' },
          { name: '_sort', value: '-date' }, // Sort by date descending
          { name: '_count', value: '1000' },
        ],
      })
    )
  );

  const resources = bundles.flatMap((bundle) => (bundle.entry ?? []).flatMap((entry) => entry.resource ?? []));

  // Grouping preserves the server's `-date` ordering within each encounter, which is what the
  // per-encounter searches produced.
  const observationsByEncounter = new Map<string, Observation[]>();
  const practitioners: Practitioner[] = [];
  resources.forEach((resource) => {
    if (resource.resourceType === 'Observation') {
      const encounterRef = resource.encounter?.reference;
      if (!encounterRef) return;
      const existing = observationsByEncounter.get(encounterRef);
      if (existing) {
        existing.push(resource);
      } else {
        observationsByEncounter.set(encounterRef, [resource]);
      }
    } else if (resource.resourceType === 'Practitioner') {
      practitioners.push(resource);
    }
  });

  return { observationsByEncounter, practitioners };
};

const fieldNameSchema = z.nativeEnum(VitalFieldNames);

const parseResourcesToDTOs = (observations: Observation[], practitioners: Practitioner[]): VitalsObservationDTO[] => {
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

  // console.log('Observation to performer map:', observationPerformerMap, observations.length, practitioners.length);

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
        vitalObservation.alertCriticality = getVitalDTOCriticalityFromObservation(observation);
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
  // if (observation.code?.coding?.[0]?.code !== '85354-9') return undefined; interesting suggestion from AI...
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

interface InputParameters extends GetVitalsForListOfEncountersRequestPayload {
  secrets: any;
}

const validateRequestParameters = (input: ZambdaInput): InputParameters => {
  if (!input.body) {
    throw new Error('Request body is required');
  }

  const { encounterIds } = JSON.parse(input.body);
  const secrets = input.secrets;

  const missingParams: string[] = [];

  if (!encounterIds || encounterIds.length === 0) {
    missingParams.push('encounterIds');
  }

  if (missingParams.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingParams);
  }

  for (const encounterId of encounterIds) {
    if (typeof encounterId !== 'string' || !isValidUUID(encounterId)) {
      throw INVALID_INPUT_ERROR(`"${encounterId}" is not a valid UUID`);
    }
  }

  return { encounterIds, secrets };
};

interface EncounterWithIdAndPatientId extends Encounter {
  id: string;
  patientId: string;
}

interface EffectInput {
  encounters: EncounterWithIdAndPatientId[];
}

const complexValidation = async (input: InputParameters, oystehr: Oystehr): Promise<EffectInput> => {
  // Add any complex validation logic here if needed
  const { encounterIds } = input;
  const resourcesFound = (
    await oystehr.fhir.search<Encounter | Patient | Appointment>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: encounterIds.map((id) => id).join(','),
        },
        {
          name: '_include',
          value: 'Encounter:patient',
        },
      ],
    })
  ).unbundle();

  const maybeEncounters = resourcesFound.filter((res) => res.resourceType === 'Encounter') as Encounter[] | undefined;
  if (maybeEncounters === undefined || maybeEncounters.length === 0) {
    throw FHIR_RESOURCE_NOT_FOUND('Encounter');
  }

  const encountersToReturn: EncounterWithIdAndPatientId[] = [];

  for (const maybeEncounter of maybeEncounters) {
    const encounterPatientId = maybeEncounter.subject?.reference?.replace('Patient/', '');
    const patientId = resourcesFound.find((res) => res.resourceType === 'Patient' && res.id === encounterPatientId)?.id;

    // ignore encounters that don't have associated resources not to drop response for other encounters
    if (!maybeEncounter || !patientId || !maybeEncounter.id) {
      continue;
    }
    // The cast is not strictly necessary since we've checked maybeEncounter.id exists,
    // but TypeScript cannot guarantee at compile time that maybeEncounter has an id.
    // To avoid the cast, we use an object spread to assert the type:
    const encounter: EncounterWithIdAndPatientId = { ...maybeEncounter, id: maybeEncounter.id, patientId };

    encountersToReturn.push(encounter);
  }

  return {
    encounters: encountersToReturn,
  };
};
