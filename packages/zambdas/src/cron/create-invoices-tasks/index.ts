import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CandidApi, CandidApiClient } from 'candidhealth';
import { InventoryRecord, InvoiceItemizationResponse } from 'candidhealth/api/resources/patientAr/resources/v1';
import { Encounter, Resource, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getCandidInventoryPages,
  getOrCreateCandidApiClient,
  getResourcesFromBatchInlineRequests,
  MISSING_REQUEST_SECRETS,
  RcmTaskCodings,
} from 'utils';
import {
  getOrCreateInvoicingConfig,
  ParsedInvoicingConfig,
  parseInvoicingConfig,
} from '../../rcm/invoice-config/helpers';
import {
  buildInvoiceTask,
  CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM,
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  getCandidEncounterIdFromEncounter,
  isCandidInvoicingEnabled,
  sendInvoiceTaskDedupeQuery,
  wrapHandler,
  ZambdaInput,
} from '../../shared';

let m2mToken: string;

const ZAMBDA_NAME = 'create-invoices-tasks';
const BATCH_CHUNK_SIZE = 25;

async function getResourcesFromParallelBatches(oystehr: Oystehr, requests: string[]): Promise<Resource[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < requests.length; i += BATCH_CHUNK_SIZE) {
    chunks.push(requests.slice(i, i + BATCH_CHUNK_SIZE));
  }
  const results = await Promise.all(chunks.map((chunk) => getResourcesFromBatchInlineRequests(oystehr, chunk)));
  return results.flat();
}

interface EncounterPackage {
  encounter: Encounter;
  claim: InventoryRecord;
  invoiceTask?: Task;
  amountCents: number;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = input;
  if (!secrets) throw MISSING_REQUEST_SECRETS;
  if (!isCandidInvoicingEnabled(secrets)) {
    console.log('Candid invoicing is disabled for this env (BILLING_INTEGRATION or feature flag); skipping');
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Candid invoicing disabled, no tasks created' }),
    };
  }
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);
  const candid = await getOrCreateCandidApiClient(oystehr, secrets);

  console.log('Fetching invoicing config from FHIR');
  const { questionnaireResponse } = await getOrCreateInvoicingConfig(oystehr);
  const invoicingConfig = parseInvoicingConfig(questionnaireResponse);
  console.log('Invoicing config loaded, dueDays:', invoicingConfig.dueDaysFromGeneration);

  const twoDaysAgo = DateTime.now().minus({ days: 2 });
  console.log('Fetching invoiceable Candid claims since:', twoDaysAgo.toISO());
  const candidClaims = await getAllCandidClaims(candid, twoDaysAgo);

  const packagesToCreate = await getEncountersWithoutTaskFhir(oystehr, candid, candidClaims);

  console.log(
    `Packages to create tasks for: ${packagesToCreate.length} ${JSON.stringify(
      packagesToCreate.map((p) => ({
        encounterId: p.encounter.id,
        claimId: p.claim.claimId,
        amountCents: p.amountCents,
      }))
    )}`
  );

  await Promise.all(packagesToCreate.map((pkg) => createTaskForEncounter(oystehr, pkg, invoicingConfig)));

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Successfully created tasks for encounters' }),
  };
});

export async function createTaskForEncounter(
  oystehr: Oystehr,
  encounterPkg: EncounterPackage,
  config: ParsedInvoicingConfig
): Promise<void> {
  try {
    const { encounter, claim, amountCents } = encounterPkg;

    console.log(
      `Creating task. patient: ${claim.patientExternalId}, claim: ${claim.claimId}, encounter: ${encounter.id}, balance (cents): ${amountCents}`
    );

    const task: Task = buildInvoiceTask({
      source: 'candid',
      claimId: claim.claimId,
      finalizationDateIso: claim.timestamp.toISOString(),
      amountCents,
      encounter,
      config,
    });

    console.log('Creating task:', JSON.stringify(task));

    const created = await oystehr.fhir.create(task, {
      ifNoneExist: sendInvoiceTaskDedupeQuery(encounter.id!),
    });

    console.log(`Ensured task: ${created.id} (encounter: ${encounter.id}, claim: ${claim.claimId})`);
  } catch (error) {
    console.error(
      `Failed to create task for encounter ${encounterPkg.encounter.id}, claim ${encounterPkg.claim.claimId}:`,
      error
    );

    captureException(error, {
      tags: {
        claimId: encounterPkg.claim.claimId,
        encounterId: encounterPkg.encounter.id,
      },
    });
  }
}

export async function getEncountersWithoutTaskFhir(
  oystehr: Oystehr,
  candid: CandidApiClient,
  claims: InventoryRecord[]
): Promise<EncounterPackage[]> {
  if (claims.length === 0) {
    console.log('No claims to check for existing FHIR tasks');
    return [];
  }

  console.log(`Checking ${claims.length} Candid claims for existing FHIR tasks`);

  const fhirResources = await getResourcesFromParallelBatches(
    oystehr,
    claims.map(
      (claim) =>
        `Encounter?identifier=${CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM}|${claim.encounterId}&_has:Task:encounter:code=${RcmTaskCodings.sendInvoiceToPatient.coding?.[0].system}|${RcmTaskCodings.sendInvoiceToPatient.coding?.[0].code}`
    )
  );
  const allEncountersCandidIds = claims.map((claim) => claim.encounterId);
  const allEncountersCandidIdsWithTasks = fhirResources
    .filter((res) => res.resourceType === 'Encounter')
    .map((res) => getCandidEncounterIdFromEncounter(res as Encounter));
  const candidEncountersIdsWithoutTasks = allEncountersCandidIds.filter(
    (id) => !allEncountersCandidIdsWithTasks.includes(id)
  );

  console.log(
    `Candid encounters: ${claims.length} total, ${allEncountersCandidIdsWithTasks.length} already have a task, ${candidEncountersIdsWithoutTasks.length} need one`
  );

  if (candidEncountersIdsWithoutTasks.length === 0) {
    console.log('No Candid encounters without tasks found');
    return [];
  }

  const encountersWithoutTasksResponse = await getResourcesFromParallelBatches(
    oystehr,
    candidEncountersIdsWithoutTasks.map(
      (claimId) => `Encounter?identifier=${CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM}|${claimId}`
    )
  );

  const encountersWithoutTasks = encountersWithoutTasksResponse.filter(
    (res) => res.resourceType === 'Encounter'
  ) as Encounter[];

  console.log(
    `FHIR encounters found for ${encountersWithoutTasks.length} of ${candidEncountersIdsWithoutTasks.length} Candid IDs without a task`
  );

  const result: Omit<EncounterPackage, 'amountCents' | 'invoiceTask'>[] = [];
  encountersWithoutTasks.forEach((encounter) => {
    const candidId = getCandidEncounterIdFromEncounter(encounter);
    const claim = claims.find((claim) => claim.encounterId === candidId);

    if (claim) {
      result.push({ encounter, claim });
    } else {
      console.warn(`No Candid claim matched FHIR encounter ${encounter.id} (candidId: ${candidId})`);
    }
  });

  if (candidEncountersIdsWithoutTasks.length !== encountersWithoutTasks.length) {
    const missingIds = candidEncountersIdsWithoutTasks.filter(
      (id) => !encountersWithoutTasks.some((enc) => getCandidEncounterIdFromEncounter(enc) === id)
    );

    console.warn(`Candid encounter IDs with no matching FHIR encounter: ${JSON.stringify(missingIds)}`);
  }

  return await populateAmountInPackages(candid, result);
}

export async function populateAmountInPackages(
  candid: CandidApiClient,
  packages: Omit<EncounterPackage, 'amountCents'>[]
): Promise<EncounterPackage[]> {
  const itemizationPromises = packages.map((pkg) => candid.patientAr.v1.itemize(CandidApi.ClaimId(pkg.claim.claimId)));
  const itemizationResponse = await Promise.all(itemizationPromises);

  const resultPackages: EncounterPackage[] = [];
  itemizationResponse.forEach((res, idx) => {
    if (!res || !res.ok || !res.body) {
      const pkg = packages[idx];
      const claimId = pkg?.claim.claimId;
      const error = new Error(`Candid itemization failed for claim ${claimId}`);

      console.error(error.message, JSON.stringify(res, null, 2));

      captureException(error, {
        tags: {
          claimId,
          encounterId: pkg?.encounter.id,
        },
      });
      return;
    }

    const itemization = res.body as InvoiceItemizationResponse;

    if (!itemization.claimId) {
      console.warn(
        `Itemization response is missing claimId, skipping (input claimId: ${packages[idx]?.claim?.claimId})`
      );

      return;
    }

    const incomingPkg = packages.find((pkg) => pkg.claim.claimId === itemization.claimId);

    if (!incomingPkg) {
      console.warn(`No matching package found for itemization claimId: ${itemization.claimId}`);
      return;
    }

    if (!itemization.patientBalanceCents && itemization.patientBalanceCents !== 0) {
      console.warn(`patientBalanceCents is missing for claim ${itemization.claimId}, skipping`);
      return;
    }

    console.log(`Itemization for claim ${itemization.claimId}: patientBalanceCents=${itemization.patientBalanceCents}`);
    resultPackages.push({
      ...incomingPkg,
      amountCents: itemization.patientBalanceCents,
    });
  });

  return resultPackages;
}

async function getAllCandidClaims(candid: CandidApiClient, sinceDate: DateTime): Promise<InventoryRecord[]> {
  const inventoryPages = await getCandidInventoryPages({
    candid,
    onlyInvoiceable: true,
    since: sinceDate,
  });

  const claimsFetched = inventoryPages?.claims ?? [];

  console.log(
    `Candid inventory returned ${claimsFetched.length} invoiceable claims (pages: ${inventoryPages?.pageCount ?? 0})`
  );

  return claimsFetched;
}
