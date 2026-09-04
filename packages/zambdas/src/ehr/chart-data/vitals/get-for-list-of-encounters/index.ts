import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Observation, Patient, Practitioner } from 'fhir/r4b';
import { chunkThings } from 'utils/lib/fhir/chat';
import { convertVitalsListToMap } from 'utils/lib/helpers/vitals/utils';
import {
  GetVitalsForListOfEncountersRequestPayload,
  GetVitalsForListOfEncountersResponseData,
} from 'utils/lib/types/api/chart-data/get-vitals.types';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR, MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { isValidUUID } from 'utils/lib/validation/helper';
import { checkOrCreateM2MClientToken } from '../../../../shared/auth';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import { wrapHandler } from '../../../../shared/sentry';
import { ZambdaInput } from '../../../../shared/types/common';
import {
  parseVitalsObservationsToDTOs,
  VITALS_ENCOUNTER_CHUNK_SIZE,
  vitalsObservationSearchParams,
} from '../../../../shared/vitals/parse-vitals-observations';
import { getVitalsEngineConfig, VitalAlertContext } from '../../../../shared/vitals-alert-config';

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
  const { encounters, patientsById } = input;
  const vitalsAlertConfig = await getVitalsEngineConfig(oystehr);

  const { observationsByEncounter, practitioners } = await fetchVitalsForEncounters(
    encounters.map((encounter) => encounter.id),
    oystehr
  );

  // Every requested encounter appears in the response, with or without vitals — same as when this
  // built the map one encounter at a time.
  const encountersVitalsMap: GetVitalsForListOfEncountersResponseData = {};
  encounters.forEach((encounter) => {
    const observations = observationsByEncounter.get(`Encounter/${encounter.id}`) ?? [];
    // The alert context is per-encounter because patients differ across the result set.
    const patient = patientsById[encounter.patientId];
    const alertContext: VitalAlertContext = {
      patientDOB: patient?.birthDate,
      patientSex: patient?.gender,
      vitalsAlertConfig,
    };
    encountersVitalsMap[encounter.id] = convertVitalsListToMap(
      parseVitalsObservationsToDTOs(observations, practitioners, alertContext)
    );
  });

  return encountersVitalsMap;
};

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
        params: vitalsObservationSearchParams(encounterIdChunk),
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
  patientsById: Record<string, Patient>;
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
  const patientsById: Record<string, Patient> = {};

  for (const maybeEncounter of maybeEncounters) {
    const encounterPatientId = maybeEncounter.subject?.reference?.replace('Patient/', '');
    const patient = resourcesFound.find((res) => res.resourceType === 'Patient' && res.id === encounterPatientId) as
      | Patient
      | undefined;
    const patientId = patient?.id;

    // ignore encounters that don't have associated resources not to drop response for other encounters
    if (!maybeEncounter || !patient || !patientId || !maybeEncounter.id) {
      continue;
    }
    patientsById[patientId] = patient;
    // The cast is not strictly necessary since we've checked maybeEncounter.id exists,
    // but TypeScript cannot guarantee at compile time that maybeEncounter has an id.
    // To avoid the cast, we use an object spread to assert the type:
    const encounter: EncounterWithIdAndPatientId = { ...maybeEncounter, id: maybeEncounter.id, patientId };

    encountersToReturn.push(encounter);
  }

  return {
    encounters: encountersToReturn,
    patientsById,
  };
};
