import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Observation, Patient, Practitioner } from 'fhir/r4b';
import {
  convertVitalsListToMap,
  extractVisionValues,
  FHIR_RESOURCE_NOT_FOUND,
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  getFullName,
  GetVitalsResponseData,
  INVALID_INPUT_ERROR,
  isValidUUID,
  PATIENT_VITALS_META_SYSTEM,
  PRIVATE_EXTENSION_BASE_URL,
  VitalFieldNames,
  VitalsBloodPressureObservationDTO,
  VitalsObservationDTO,
  VitalsVisionObservationDTO,
} from 'utils';
import * as z from 'zod';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../../shared';

let m2mToken: string;

export const index = wrapHandler('get-vitals', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    console.log('Validating input');
    const { encounterId, secrets } = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const effectInput = await complexValidation({ encounterId, secrets }, oystehr);
    const results = await performEffect(effectInput, oystehr);

    return {
      body: JSON.stringify(results),
      statusCode: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      body: JSON.stringify({ message: JSON.stringify(error) }),
      statusCode: 500,
    };
  }
});

const performEffect = async (input: EffectInput, oystehr: Oystehr): Promise<GetVitalsResponseData> => {
  const { encounter, mode } = input;
  if (mode === 'current') {
    // Fetch current vitals for the encounter
    const list = await fetchVitalsForEncounter(encounter.id, oystehr);
    const map = convertVitalsListToMap(list);
    console.log('Vitals map:', map);
    return map;
  } else {
    throw new Error('Historical mode is not implemented yet');
  }

  // Implement the effect logic here
};

const fetchVitalsForEncounter = async (encounterId: string, oystehr: Oystehr): Promise<any> => {
  const currentVitalsAndPerformers = (
    await oystehr.fhir.search<Observation | Practitioner>({
      resourceType: 'Observation',
      params: [
        { name: 'encounter._id', value: encounterId },
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
      console.log('Processing observation ID:', obsId);
      const observation = observations.find((obs) => obs.id === obsId);
      console.log('Observation:', observation, 'Performer:', performer);
      if (!observation || !observation.id) return [];
      // todo: don't base this on meta tag, but on the observation code
      const fieldCode = observation?.meta?.tag?.find(
        (tag) => tag.system === `${PRIVATE_EXTENSION_BASE_URL}/${PATIENT_VITALS_META_SYSTEM}`
      )?.code;

      console.log('Field code:', fieldCode);

      if (!fieldCode) return [];

      const parsedField = fieldNameSchema.safeParse(fieldCode);
      if (!parsedField.success) return [];

      const field = parsedField.data;

      let vitalObservation: VitalsObservationDTO | undefined = undefined;

      if (field === VitalFieldNames.VitalBloodPressure) {
        vitalObservation = parseBloodPressureObservation(observation, performer);
      } else if (field === VitalFieldNames.VitalVision) {
        vitalObservation = parseVisionObservation(observation, performer);
      } else {
        vitalObservation = parseNumericValueObservation(observation, performer, field);
      }

      if (vitalObservation) {
        return vitalObservation;
      }
      return [];
    }
  );
  console.log('Parsed vitals DTOs:', vitalsDTOs);
  return vitalsDTOs;
};

const parseBloodPressureObservation = (
  observation: Observation,
  performer: Practitioner
): VitalsBloodPressureObservationDTO | undefined => {
  // if (observation.code?.coding?.[0]?.code !== '85354-9') return undefined; interesting suggestion from AI...
  const systolicBP = observation.component?.find(
    (comp) => comp.code?.coding?.some((cc) => cc.code === '8480-6' && cc.system === 'http://loinc.org')
  )?.valueQuantity?.value;
  const diastolicBP = observation.component?.find(
    (comp) => comp.code?.coding?.some((cc) => cc.code === '8462-4' && cc.system === 'http://loinc.org')
  )?.valueQuantity?.value;
  console.log('Systolic BP:', systolicBP, 'Diastolic BP:', diastolicBP);
  if (systolicBP === undefined || diastolicBP === undefined) return undefined;
  return {
    resourceId: observation.id,
    field: VitalFieldNames.VitalBloodPressure,
    systolicPressure: systolicBP,
    diastolicPressure: diastolicBP,
    authorId: performer.id,
    authorName: getFullName(performer),
    observationMethod: undefined, // todo: parse from method
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
  console.log(`Parsing observation for field ${field}:`, 'Value:', value);
  if (value === undefined) return undefined;
  return {
    resourceId: observation.id,
    field,
    value,
    authorId: performer.id,
    authorName: getFullName(performer),
    lastUpdated: observation.effectiveDateTime || '',
  };
};

interface InputParameters {
  secrets: any;
  encounterId?: string;
  beforeEncounterId?: string;
}

const validateRequestParameters = (input: ZambdaInput): InputParameters => {
  if (!input.body) {
    throw new Error('Request body is required');
  }

  const { encounterId, beforeEncounterId } = JSON.parse(input.body);
  const secrets = input.secrets;

  if (encounterId && beforeEncounterId) {
    throw INVALID_INPUT_ERROR('Cannot specify both "encounterId" and "beforeEncounterId"');
  }

  if (encounterId && !isValidUUID(encounterId)) {
    throw INVALID_INPUT_ERROR(`"${encounterId}" is not a valid UUID`);
  }
  if (beforeEncounterId && !isValidUUID(beforeEncounterId)) {
    throw INVALID_INPUT_ERROR(`"${beforeEncounterId}" is not a valid UUID`);
  }

  if (!encounterId && !beforeEncounterId) {
    throw INVALID_INPUT_ERROR('Cannot specify both "encounterId" and "beforeEncounterId"');
  }

  return { encounterId, beforeEncounterId, secrets };
};

interface EncounterWithId extends Encounter {
  id: string;
}

interface EffectInput {
  encounter: EncounterWithId;
  mode: 'historical' | 'current';
  patientId?: string;
}

const complexValidation = async (input: InputParameters, oystehr: Oystehr): Promise<EffectInput> => {
  // Add any complex validation logic here if needed
  const { encounterId: maybeEncounterId, beforeEncounterId } = input;
  const encounterId: string = maybeEncounterId || beforeEncounterId!;
  const encounterAndPatient = (
    await oystehr.fhir.search<Encounter | Patient>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: encounterId,
        },
        {
          name: '_include',
          value: 'Encounter:patient',
        },
      ],
    })
  ).unbundle();
  const maybeEncounter = encounterAndPatient.find((res) => res.resourceType === 'Encounter');
  const patientId = encounterAndPatient.find((res) => res.resourceType === 'Patient')?.id;

  if (!maybeEncounter) {
    throw FHIR_RESOURCE_NOT_FOUND('Encounter');
  }
  if (!patientId) {
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`No patient found for Encounter/${encounterId}`);
  }
  if (!maybeEncounter.id) {
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`No id found for Encounter/${encounterId}`);
  }
  // The cast is not strictly necessary since we've checked maybeEncounter.id exists,
  // but TypeScript cannot guarantee at compile time that maybeEncounter has an id.
  // To avoid the cast, we use an object spread to assert the type:
  const encounter: EncounterWithId = { ...maybeEncounter, id: maybeEncounter.id };

  return {
    encounter,
    mode: beforeEncounterId ? 'historical' : 'current',
    patientId,
  };
};
