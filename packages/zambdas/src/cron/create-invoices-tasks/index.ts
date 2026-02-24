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
  getSecret,
  InvoiceTaskInput,
  mapDisplayToInvoiceTaskStatus,
  RcmTaskCodings,
  SecretsKeys,
  TEXTING_CONFIG,
} from 'utils';
import { createInvoiceTaskInput } from 'utils/lib/helpers/tasks/invoices-tasks';
import {
  CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM,
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getCandidEncounterIdFromEncounter,
  topLevelCatch,
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
  try {
    const { secrets } = input;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    const candid = createCandidApiClient(secrets);

    const twoDaysAgo = DateTime.now().minus({ days: 2 });
    const candidClaims = await getAllCandidClaims(candid, twoDaysAgo);
    console.log('getting candid claims for the past two days');

    console.log('getting pending and to create packages');
    const packagesToCreate = await getEncountersWithoutTaskFhir(oystehr, candid, candidClaims);

    console.log('encounters without a task: ', packagesToCreate.length);

    const promises: Promise<void>[] = [];
    packagesToCreate.forEach((encounter) => {
      promises.push(createTaskForEncounter(oystehr, encounter));
    });
    await Promise.all(promises);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully created tasks for encounters' }),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    console.log('Error occurred:', error);
    return await topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

async function getInvoiceTaskInput(
  claimId: string,
  finalizationDate: Date,
  patientBalanceInCents: number
): Promise<InvoiceTaskInput> {
  try {
    const smsMessageFromSecret = TEXTING_CONFIG.invoicing.smsMessage;
    const memoFromSecret = TEXTING_CONFIG.invoicing.stripeMemoMessage;
    const dueDateFromSecret = TEXTING_CONFIG.invoicing.dueDateInDays;
    const dueDate = DateTime.now().plus({ days: dueDateFromSecret }).toISODate();
    const finalizationDateIso = finalizationDate.toISOString();

    return {
      smsTextMessage: smsMessageFromSecret,
      memo: memoFromSecret,
      dueDate,
      amountCents: patientBalanceInCents,
      claimId,
      finalizationDate: finalizationDateIso,
    };
  } catch (error) {
    console.error('Error fetching prefilled invoice info: ', error);
    throw new Error('Error fetching prefilled invoice info: ' + error);
  }
}

export async function createTaskForEncounter(oystehr: Oystehr, encounterPkg: EncounterPackage): Promise<void> {
  try {
    const { encounter, claim, amountCents } = encounterPkg;
    const patientId = encounter.subject?.reference?.replace('Patient/', '');
    if (!patientId) throw new Error('Patient ID not found in encounter: ' + encounter.id);
    const prefilledInvoiceInfo = await getInvoiceTaskInput(claim.claimId, claim.timestamp, amountCents);
    console.log(
      `Creating task. patient: ${claim.patientExternalId}, claim: ${claim.claimId}, oyst encounter: ${encounter.id} balance (cents): ${amountCents}`
    );

    const task: Task = {
      resourceType: 'Task',
      status: readyTaskStatus,
      description: `Send invoice for $${(amountCents / 100).toFixed(2)}`,
      intent: 'order',
      code: RcmTaskCodings.sendInvoiceToPatient,
      encounter: createReference(encounter),
      for: { reference: `Patient/${patientId}` },
      authoredOn: DateTime.now().toISO(),
      input: createInvoiceTaskInput(prefilledInvoiceInfo),
    };

    const created = await oystehr.fhir.create(task);
    console.log('Created task: ', created.id);
  } catch (error) {
    captureException(error);
  }
}

export async function getEncountersWithoutTaskFhir(
  oystehr: Oystehr,
  candid: CandidApiClient,
  claims: InventoryRecord[]
): Promise<EncounterPackage[]> {
  console.log('Getting encounters with a task');
  const fhirResources = await getResourcesFromBatchInlineRequests(
    oystehr,
    claims.map(
      (claim) =>
        `Encounter?identifier=${CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM}|${claim.encounterId}&_has:Task:encounter:code=${RcmTaskCodings.sendInvoiceToPatient.coding?.[0].system}|${RcmTaskCodings.sendInvoiceToPatient.coding?.[0].code}`
    )
  );
  console.log('Encounters with tasks: ', fhirResources.length);
  const allEncountersCandidIds = claims.map((claim) => claim.encounterId);
  const allEncountersCandidIdsWithTasks = fhirResources
    .filter((res) => res.resourceType === 'Encounter')
    .map((res) => getCandidEncounterIdFromEncounter(res as Encounter));
  const candidEncountersIdsWithoutTasks = allEncountersCandidIds.filter(
    (id) => !allEncountersCandidIdsWithTasks.includes(id)
  );

  console.log('Searching for encounters without a task');
  const encountersWithoutTasksResponse = await getResourcesFromBatchInlineRequests(
    oystehr,
    candidEncountersIdsWithoutTasks.map(
      (claimId) => `Encounter?identifier=${CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM}|${claimId}`
    )
  );
  const encountersWithoutTasks = encountersWithoutTasksResponse.filter(
    (res) => res.resourceType === 'Encounter'
  ) as Encounter[];
  console.log('Encounters without a task found raw: ', encountersWithoutTasks.length);

  const result: Omit<EncounterPackage, 'amountCents' | 'invoiceTask'>[] = [];
  encountersWithoutTasks.forEach((encounter) => {
    const claim = claims.find((claim) => claim.encounterId === getCandidEncounterIdFromEncounter(encounter));
    if (claim) {
      result.push({
        encounter,
        claim,
      });
    }
  });
  console.log('Getting amounts for encounters and filtering zero amounts:');
  return await populateAmountInPackagesAndFilterZeroAmount(candid, result);
}

export async function populateAmountInPackagesAndFilterZeroAmount(
  candid: CandidApiClient,
  packages: Omit<EncounterPackage, 'amountCents'>[]
): Promise<EncounterPackage[]> {
  const itemizationPromises = packages.map((pkg) => candid.patientAr.v1.itemize(CandidApi.ClaimId(pkg.claim.claimId)));
  const itemizationResponse = await Promise.all(itemizationPromises);

  const resultPackages: EncounterPackage[] = [];
  itemizationResponse.forEach((res) => {
    if (res && res.ok && res.body) {
      const itemization = res.body as InvoiceItemizationResponse;
      const incomingPkg = packages.find((pkg) => pkg.claim.claimId === itemization.claimId);
      if (
        itemization.claimId &&
        itemization.patientBalanceCents &&
        itemization.patientBalanceCents > 0 &&
        incomingPkg
      ) {
        resultPackages.push({
          ...incomingPkg,
          amountCents: itemization.patientBalanceCents,
        });
      }
    }
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

  const claimsFetched = inventoryPages?.claims;
  console.log('fetched claims: ', claimsFetched?.length);
  if (claimsFetched?.length && claimsFetched.length > 0) {
    return claimsFetched;
  }
  return [];
}
