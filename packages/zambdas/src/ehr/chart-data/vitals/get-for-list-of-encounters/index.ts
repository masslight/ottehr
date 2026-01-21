import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Observation, Patient, Practitioner } from 'fhir/r4b';
import {
  convertVitalsListToMap,
  extractBloodPressureObservationMethod,
  extractHeartbeatObservationMethod,
  extractOxySaturationObservationMethod,
  extractTemperatureObservationMethod,
  extractVisionValues,
  FHIR_RESOURCE_NOT_FOUND,
  getFullName,
  getSecret,
  getVitalDTOCriticalityFromObservation,
  GetVitalsForListOfEncountersRequestPayload,
  GetVitalsForListOfEncountersResponseData,
  INVALID_INPUT_ERROR,
  isValidUUID,
  LOINC_SYSTEM,
  MISSING_REQUIRED_PARAMETERS,
  parseLastMenstrualPeriodObservation,
  PATIENT_VITALS_META_SYSTEM,
  PRIVATE_EXTENSION_BASE_URL,
  SecretsKeys,
  VITAL_DIASTOLIC_BLOOD_PRESSURE_LOINC_CODE,
  VITAL_SYSTOLIC_BLOOD_PRESSURE_LOINC_CODE,
  VitalFieldNames,
  VitalsBloodPressureObservationDTO,
  VitalsHeartbeatObservationDTO,
  VitalsObservationDTO,
  VitalsOxygenSatObservationDTO,
  VitalsTemperatureObservationDTO,
  VitalsVisionObservationDTO,
} from 'utils';
import * as z from 'zod';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'get-vitals-for-list-of-encounters';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Validating input: ${JSON.stringify(input.body)}`);
    const { encounterIds, secrets } = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    console.log(`Performing complex validation for encounterId: ${encounterIds}`);
    const effectInput = await complexValidation({ encounterIds, secrets }, oystehr);
    console.log(`Effect input: ${JSON.stringify(effectInput)}`);
    const results = await performEffect(effectInput, oystehr);

    return {
      body: JSON.stringify(results),
      statusCode: 200,
    };
  } catch (error) {
    console.log(error);
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});

const performEffect = async (
  input: EffectInput,
  oystehr: Oystehr
): Promise<GetVitalsForListOfEncountersResponseData> => {
  const { encounters } = input;
  // Fetch current vitals for the encounter
  const encountersVitalsMap: GetVitalsForListOfEncountersResponseData = {};
  await Promise.all(
    encounters.map(async (encounter) => {
      console.log(`Fetching vitals for encounter id: ${encounter.id}`);
      const vitalsList = await fetchVitalsForEncounter(encounter.id, oystehr);
      const vitalsMap = convertVitalsListToMap(vitalsList);
      encountersVitalsMap[encounter.id] = vitalsMap;
    })
  );
  return encountersVitalsMap;
};

const fetchVitalsForEncounter = async (encounterId: string, oystehr: Oystehr): Promise<VitalsObservationDTO[]> => {
  const currentVitalsAndPerformers = (
    await oystehr.fhir.search<Observation | Practitioner>({
      resourceType: 'Observation',
      params: [
        { name: 'encounter._id', value: encounterId },
        { name: 'status:not', value: 'entered-in-error,cancelled,unknown,cannot-be-obtained' },
        { name: '_tag', value: `${PRIVATE_EXTENSION_BASE_URL}/${PATIENT_VITALS_META_SYSTEM}|` },
        { name: '_include', value: 'Observation:performer' },
        { name: '_sort', value: '-date' }, // Sort by date descending
      ],
    })
  ).unbundle();

  const observations = currentVitalsAndPerformers.filter((res) => res.resourceType === 'Observation') as Observation[];
  const practitioners = currentVitalsAndPerformers.filter(
    (res) => res.resourceType === 'Practitioner'
  ) as Practitioner[];

  return parseResourcesToDTOs(observations, practitioners);
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
    visionOptions,
  } = extractVisionValues(components);

  if (leftEyeVisionText === undefined || rightEyeVisionText === undefined) return undefined;

  return {
    resourceId: observation.id,
    field: VitalFieldNames.VitalVision,
    leftEyeVisionText,
    rightEyeVisionText,
    authorId: performer.id,
    authorName: getFullName(performer),
    lastUpdated: observation.effectiveDateTime || '',
    extraVisionOptions: visionOptions,
  };
};

type AllOtherFields =
  | VitalFieldNames.VitalHeartbeat
  | VitalFieldNames.VitalOxygenSaturation
  | VitalFieldNames.VitalTemperature
  | VitalFieldNames.VitalRespirationRate
  | VitalFieldNames.VitalHeight
  | VitalFieldNames.VitalWeight;

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
