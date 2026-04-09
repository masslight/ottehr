import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CandidApi, CandidApiClient } from 'candidhealth';
import { InventoryRecord, InvoiceItemizationResponse } from 'candidhealth/api/resources/patientAr/resources/v1';
import { Encounter, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  createCandidApiClient,
  createReference,
  getCandidInventoryPages,
  getResourcesFromBatchInlineRequests,
  InvoiceTaskInput,
  mapDisplayToInvoiceTaskStatus,
  RcmTaskCodings,
  ZERO_BALANCE_BUSINESS_STATUS,
} from 'utils';
import { createInvoiceTaskInput } from 'utils/lib/helpers/tasks/invoices-tasks';
import {
  getOrCreateInvoicingConfig,
  ParsedInvoicingConfig,
  parseInvoicingConfig,
} from '../../rcm/invoice-config/helpers';
import {
  CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM,
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getCandidEncounterIdFromEncounter,
  wrapHandler,
  ZambdaInput,
} from '../../shared';

let m2mToken: string;

const ZAMBDA_NAME = 'create-invoices-tasks';
const readyTaskStatus = mapDisplayToInvoiceTaskStatus('ready');

interface EncounterPackage {
  encounter: Encounter;
  claim: InventoryRecord;
  invoiceTask?: Task;
  amountCents: number;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = input;
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);
  const candid = createCandidApiClient(secrets);

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

function getInvoiceTaskInput(
  claimId: string,
  finalizationDate: Date,
  patientBalanceInCents: number,
  config: ParsedInvoicingConfig
): InvoiceTaskInput {
  const dueDate = DateTime.now().plus({ days: config.dueDaysFromGeneration }).toISODate();
  const finalizationDateIso = finalizationDate.toISOString();

  return {
    smsTextMessage: config.defaultSmsTemplate,
    memo: config.defaultInvoiceMemo,
    dueDate,
    amountCents: patientBalanceInCents,
    claimId,
    finalizationDate: finalizationDateIso,
  };
}

export async function createTaskForEncounter(
  oystehr: Oystehr,
  encounterPkg: EncounterPackage,
  config: ParsedInvoicingConfig
): Promise<void> {
  try {
    const { encounter, claim, amountCents } = encounterPkg;
    const patientId = encounter.subject?.reference?.replace('Patient/', '');

    if (!patientId) throw new Error('Patient ID not found in encounter: ' + encounter.id);

    const prefilledInvoiceInfo = getInvoiceTaskInput(claim.claimId, claim.timestamp, amountCents, config);

    console.log(
      `Creating task. patient: ${claim.patientExternalId}, claim: ${claim.claimId}, encounter: ${encounter.id}, balance (cents): ${amountCents}`
    );

    const task: Task = {
      resourceType: 'Task',
      status: readyTaskStatus,
      description: `Send invoice for $${(amountCents / 100).toFixed(2)}`,
      intent: 'order',
      code: RcmTaskCodings.sendInvoiceToPatient,
      encounter: createReference(encounter),
      for: { reference: `Patient/${patientId}` },
      authoredOn: prefilledInvoiceInfo.finalizationDate ?? DateTime.now().toISO(),
      ...(encounter.period?.start
        ? { executionPeriod: { start: encounter.period.start, end: encounter.period.start } }
        : {}),
      ...(amountCents === 0 ? { businessStatus: ZERO_BALANCE_BUSINESS_STATUS } : {}),
      input: createInvoiceTaskInput(prefilledInvoiceInfo),
    };

    console.log('Creating task:', JSON.stringify(task));

    const created = await oystehr.fhir.create(task);

    console.log(`Created task: ${created.id} (encounter: ${encounter.id}, claim: ${claim.claimId})`);
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

  const fhirResources = await getResourcesFromBatchInlineRequests(
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

  const encountersWithoutTasksResponse = await getResourcesFromBatchInlineRequests(
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
    limitPerPage: 100,
    onlyInvoiceable: true,
    since: sinceDate,
  });

  const claimsFetched = inventoryPages?.claims ?? [];

  console.log(
    `Candid inventory returned ${claimsFetched.length} invoiceable claims (pages: ${inventoryPages?.pageCount ?? 0})`
  );

  return claimsFetched;
}
