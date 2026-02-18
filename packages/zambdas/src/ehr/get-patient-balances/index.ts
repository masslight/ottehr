import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CandidApi, CandidApiClient } from 'candidhealth';
import { APIResponse } from 'candidhealth/core';
import { Appointment, Encounter } from 'fhir/r4b';
import { chunkThings, createCandidApiClient, GetPatientBalancesZambdaOutput } from 'utils';
import {
  CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM,
  checkOrCreateM2MClientToken,
  createOystehrClient,
  lambdaResponse,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { ValidatedInput, validateInput, validateSecrets } from './validateRequestParameters';

type EncounterIdMap = Map<
  string,
  {
    encounterDate: string;
    appointmentId: string;
    candidId: string;
    patientBalanceCents?: number;
  }
>;

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'get-patient-balances';
// https://docs.joincandidhealth.com/introduction/getting-started#rate-limiting rate limited to 1000/10s
const CANDID_API_CONCURRENCY_LIMIT = 10;

export const index = wrapHandler(ZAMBDA_NAME, async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const secrets = validateSecrets(unsafeInput.secrets);

    const validatedInput = await validateInput(unsafeInput);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    console.group('creating candid api client');
    const candidApiClient = createCandidApiClient(secrets);
    console.groupEnd();
    console.debug('creating candid api client success');

    const response = await performEffect(validatedInput, oystehr, candidApiClient);

    return lambdaResponse(200, response);
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return lambdaResponse(500, { error: error.message });
  }
});

export async function performEffect(
  validatedInput: ValidatedInput,
  oystehr: Oystehr,
  candidApiClient: CandidApiClient
): Promise<GetPatientBalancesZambdaOutput> {
  const { patientId } = validatedInput.body;

  const noData = {
    encounters: [],
    totalBalanceCents: 0,
  };

  console.group('getFhirEncountersAndAppointmentsForPatient');
  const { encounters, appointments } = await getFhirEncountersAndAppointmentsForPatient(oystehr, patientId);
  console.groupEnd();
  console.debug('getFhirEncountersAndAppointmentsForPatient success');
  if (encounters.length === 0) {
    return noData;
  }

  const encounterDataMap: EncounterIdMap = new Map();
  const candidIdToEncounterIdMap = new Map<string, string>();
  const claimIdToEncounterIdMap = new Map<string, string>();

  encounters.forEach((encounter) => {
    const appointmentId = encounter.appointment?.[0].reference?.split('/')[1];
    const appointment = appointments.find((app) => app.id === appointmentId);
    const encounterDate = appointment?.start;
    const candidId = encounter.identifier?.find(
      (identifier) => identifier.system === CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM && identifier.value != null
    )?.value;
    if (!appointmentId || !encounterDate || !candidId) {
      throw new Error(`Encounter is missing appointmentId, encounterDate, or candidId: ${encounter.id}`);
    }
    encounterDataMap.set(encounter.id!, {
      encounterDate,
      appointmentId,
      candidId,
    });
    candidIdToEncounterIdMap.set(candidId, encounter.id!);
  });

  console.group('getAllCandidEncounters');
  const candidEncounters = await getAllCandidEncounters(candidApiClient, encounterDataMap);
  console.groupEnd();
  console.debug('getAllCandidEncounters success');
  if (candidEncounters.length === 0) {
    return noData;
  }

  // Unpack the array of claims (should only be one) and grab the first claim id
  console.group('addIdsToMaps');
  addIdsToMaps(candidEncounters, candidIdToEncounterIdMap, claimIdToEncounterIdMap);
  console.groupEnd();
  console.debug('addIdsToMaps success');
  if (claimIdToEncounterIdMap.size === 0) {
    return noData;
  }

  console.log('claimIdToEncounterIdMap', claimIdToEncounterIdMap);

  // For each Candid claim id, call the Candid invoice itemization API endpoint
  console.group('getAllCandidClaims');
  const claims = await getAllCandidClaims(candidApiClient, claimIdToEncounterIdMap);
  console.groupEnd();
  console.debug('getAllCandidClaims success');
  if (claims.length === 0) {
    return noData;
  }

  // Save the balances in the map
  console.group('saveBalancesInMap');
  saveBalancesInMap(claims, claimIdToEncounterIdMap, encounterDataMap);
  console.groupEnd();
  console.debug('saveBalancesInMap success');

  console.log('encounterDataMap', encounterDataMap);

  const returnData = Array.from(encounterDataMap.entries()).map(([encounterId, mapValue]) => ({
    encounterId,
    encounterDate: mapValue.encounterDate,
    appointmentId: mapValue.appointmentId,
    patientBalanceCents: mapValue.patientBalanceCents || 0,
  }));
  return {
    encounters: returnData,
    totalBalanceCents: returnData.reduce((acc, { patientBalanceCents }) => acc + patientBalanceCents, 0),
  };
}

async function getFhirEncountersAndAppointmentsForPatient(
  oystehr: Oystehr,
  patientId: string
): Promise<{ encounters: Encounter[]; appointments: Appointment[] }> {
  const resourcesResponse = await oystehr.fhir.search<Encounter | Appointment>({
    resourceType: 'Encounter',
    params: [
      {
        name: 'subject',
        value: `Patient/${patientId}`,
      },
      {
        name: '_include',
        value: 'Encounter:appointment',
      },
    ],
  });
  const resources = resourcesResponse.unbundle();
  const encounters = resources.filter((resource) => resource.resourceType === 'Encounter') as Encounter[];
  const appointments = resources.filter((resource) => resource.resourceType === 'Appointment') as Appointment[];
  console.log(`Found ${encounters.length} encounters for patient ${patientId}`);
  return {
    encounters,
    appointments,
  };
}

async function getAllCandidEncounters(
  candidApiClient: CandidApiClient,
  encounterIdMap: EncounterIdMap
): Promise<APIResponse<CandidApi.encounters.v4.Encounter, CandidApi.encounters.v4.get.Error._Unknown>[]> {
  const candidIds = Array.from(encounterIdMap.values()).map(({ candidId }) => candidId);
  const chunkedCandidIds = chunkThings(candidIds, CANDID_API_CONCURRENCY_LIMIT);
  const candidEncounters: APIResponse<CandidApi.encounters.v4.Encounter, CandidApi.encounters.v4.get.Error._Unknown>[] =
    [];
  for (const chunk of chunkedCandidIds) {
    const currentCandidEncounters = await Promise.all(
      chunk.map((candidId) => candidApiClient.encounters.v4.get(CandidApi.EncounterId(candidId)))
    );
    candidEncounters.push(...currentCandidEncounters);
  }
  console.log(`Fetched ${candidEncounters.length} Candid encounters`);
  return candidEncounters;
}

function addIdsToMaps(
  candidEncounters: APIResponse<CandidApi.encounters.v4.Encounter, CandidApi.encounters.v4.get.Error._Unknown>[],
  candidIdToEncounterIdMap: Map<string, string>,
  claimIdToEncounterIdMap: Map<string, string>
): void {
  candidEncounters.forEach((candidEncounter) => {
    if (!candidEncounter.ok) {
      throw new Error(`Failed to fetch Candid encounter: ${JSON.stringify(candidEncounter.error)}`);
    }

    const { claims } = candidEncounter.body;
    if (claims.length !== 1) {
      throw new Error(`Expected exactly one claim per encounter, but got ${claims.length}`);
    }

    const candidId = candidEncounter.body.encounterId;
    const claimId = claims[0].claimId;
    const encounterId = candidIdToEncounterIdMap.get(candidId);

    claimIdToEncounterIdMap.set(claimId, encounterId!);
  });
}

async function getAllCandidClaims(
  candidApiClient: CandidApiClient,
  claimIdMap: Map<string, string>
): Promise<APIResponse<CandidApi.patientAr.v1.InvoiceItemizationResponse, CandidApi.patientAr.v1.itemize.Error>[]> {
  const claimIds = Array.from(claimIdMap.keys());
  const chunkedClaimIds = chunkThings(claimIds, CANDID_API_CONCURRENCY_LIMIT);
  const claims: APIResponse<CandidApi.patientAr.v1.InvoiceItemizationResponse, CandidApi.patientAr.v1.itemize.Error>[] =
    [];
  for (const chunk of chunkedClaimIds) {
    const currentClaims = await Promise.all(
      chunk.map((claimId) => candidApiClient.patientAr.v1.itemize(CandidApi.ClaimId(claimId)))
    );
    claims.push(...currentClaims);
  }
  console.log(`Fetched ${claims.length} claims`);
  return claims;
}

function saveBalancesInMap(
  candidClaims: APIResponse<CandidApi.patientAr.v1.InvoiceItemizationResponse, CandidApi.patientAr.v1.itemize.Error>[],
  claimIdToEncounterIdMap: Map<string, string>,
  encounterDataMap: EncounterIdMap
): void {
  candidClaims.forEach((candidClaim) => {
    if (!candidClaim.ok) {
      throw new Error(`Failed to fetch Candid claim: ${JSON.stringify(candidClaim.error)}`);
    }

    const claimId = candidClaim.body.claimId;
    const encounterId = claimIdToEncounterIdMap.get(claimId);
    const mapValue = encounterDataMap.get(encounterId!);
    if (!mapValue) {
      throw new Error(`No map value found for encounterId ${encounterId}`);
    }
    mapValue.patientBalanceCents = candidClaim.body.patientBalanceCents;
    encounterDataMap.set(encounterId!, mapValue);
  });
}
