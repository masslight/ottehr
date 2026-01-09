import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CandidApi, CandidApiClient } from 'candidhealth';
import { InventoryRecord, InvoiceItemizationResponse } from 'candidhealth/api/resources/patientAr/resources/v1';
import { Encounter, Resource, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  createCandidApiClient,
  createReference,
  getCandidInventoryPagesRecursive,
  getResourcesFromBatchInlineRequests,
  getSecret,
  PrefilledInvoiceInfo,
  RCM_TASK_SYSTEM,
  RcmTaskCode,
  RcmTaskCodings,
  SecretsKeys,
  textingConfig,
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

const ZAMBDA_NAME = 'sub-create-invoices-tasks';
const pendingTaskStatus: Task['status'] = 'ready';

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

    // 1. getting candid claims for the past two weeks
    // 2. we are getting encounters with pending tasks so we can update them
    // 3. getting encounters without a task using claims id
    // 4. getting itemization response for both groups at the same time to optimize this process

    const twoWeeksAgo = DateTime.now().minus({ weeks: 2 });
    const candidClaims = await getAllCandidClaims(candid, twoWeeksAgo);
    const twoDaysAgo = DateTime.now().minus({ days: 2 });
    console.log('getting candid claims for the past two weeks');
    const claimsForThePastTwoDays = candidClaims.filter((claim) => DateTime.fromJSDate(claim.timestamp) >= twoDaysAgo);

    console.log('getting pending and to create packages');
    const [pendingPackagesToUpdate, packagesToCreate] = await Promise.all([
      getEncountersWithPendingTasksFhir(oystehr, candid, candidClaims, twoWeeksAgo),
      getEncountersWithoutTaskFhir(oystehr, candid, claimsForThePastTwoDays),
    ]);

    console.log('encounters without a task: ', packagesToCreate.length);
    console.log('encounters with pending task: ', pendingPackagesToUpdate.length);

    const promises: Promise<void>[] = [];
    packagesToCreate.forEach((encounter) => {
      promises.push(createTaskForEncounter(oystehr, encounter));
    });
    pendingPackagesToUpdate.forEach((encounter) => {
      promises.push(updateTaskForEncounter(oystehr, encounter));
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

async function getPrefilledInvoiceInfo(patientBalanceInCents: number): Promise<PrefilledInvoiceInfo> {
  try {
    const smsMessageFromSecret = textingConfig.invoicing.smsMessage;
    const memoFromSecret = textingConfig.invoicing.stripeMemoMessage;
    const dueDateFromSecret = textingConfig.invoicing.dueDateInDays;
    const dueDate = DateTime.now().plus({ days: dueDateFromSecret }).toISODate();

    return {
      smsTextMessage: smsMessageFromSecret,
      memo: memoFromSecret,
      dueDate,
      amountCents: patientBalanceInCents,
    };
  } catch (error) {
    console.error('Error fetching prefilled invoice info: ', error);
    throw new Error('Error fetching prefilled invoice info: ' + error);
  }
}

async function createTaskForEncounter(oystehr: Oystehr, encounterPkg: EncounterPackage): Promise<void> {
  try {
    const { encounter, claim, amountCents } = encounterPkg;
    const patientId = encounter.subject?.reference?.replace('Patient/', '');
    if (!patientId) throw new Error('Patient ID not found in encounter: ' + encounter.id);
    const prefilledInvoiceInfo = await getPrefilledInvoiceInfo(amountCents);
    console.log(
      `Creating task. patient: ${claim.patientExternalId}, claim: ${claim.claimId}, oyst encounter: ${encounter.id} balance (cents): ${amountCents}`
    );

    const task: Task = {
      resourceType: 'Task',
      status: pendingTaskStatus,
      intent: 'order',
      code: RcmTaskCodings.sendInvoiceToPatient,
      encounter: createReference(encounter),
      input: createInvoiceTaskInput(prefilledInvoiceInfo),
    };

    const created = await oystehr.fhir.create(task);
    console.log('Created task: ', created.id);
  } catch (error) {
    captureException(error);
  }
}

async function updateTaskForEncounter(oystehr: Oystehr, encounterPkg: EncounterPackage): Promise<void> {
  try {
    const { encounter, claim, invoiceTask, amountCents } = encounterPkg;
    if (!invoiceTask?.id) {
      console.error('Task cannot be updated for encounter: ', encounter.id);
      return;
    }
    const prefilledInvoiceInfo = await getPrefilledInvoiceInfo(amountCents);
    console.log(
      `Updating task. patient: ${claim.patientExternalId}, claim: ${claim.claimId}, oyst encounter: ${encounter.id} balance (cents): ${amountCents}`
    );

    await oystehr.fhir.patch({
      resourceType: 'Task',
      id: invoiceTask.id,
      operations: [{ op: 'replace', path: '/input', value: createInvoiceTaskInput(prefilledInvoiceInfo) }],
    });
  } catch (error) {
    captureException(error);
  }
}

async function getEncountersWithPendingTasksFhir(
  oystehr: Oystehr,
  candid: CandidApiClient,
  claims: InventoryRecord[],
  sinceDate: DateTime
): Promise<EncounterPackage[]> {
  const result = (
    await oystehr.fhir.search({
      resourceType: 'Task',
      params: [
        {
          name: 'status',
          value: pendingTaskStatus,
        },
        {
          name: 'code',
          value: `${RCM_TASK_SYSTEM}|${RcmTaskCode.sendInvoiceToPatient}`,
        },
        {
          name: '_include',
          value: 'Task:encounter',
        },
        {
          name: 'authored-on',
          value: `ge${sinceDate.toISODate()}`,
        },
      ],
    })
  ).unbundle();

  const packages: Omit<EncounterPackage, 'amountCents'>[] = [];
  result
    .filter((res) => res.resourceType === 'Encounter')
    .forEach((resource) => {
      const encounter = resource as Encounter;
      const candidEncounterId = getCandidEncounterIdFromEncounter(encounter);
      const claim = claims.find((el) => el.encounterId === candidEncounterId);
      if (claim) {
        const task = result.find(
          (res) =>
            res.resourceType === 'Task' && (res as Task).encounter?.reference === createReference(encounter).reference
        ) as Task;
        if (task) {
          packages.push({
            encounter,
            invoiceTask: task,
            claim,
          });
        }
      }
    });
  return await populateAmountInPackagesAndFilterZeroAmount(candid, packages);
}

async function getEncountersWithoutTaskFhir(
  oystehr: Oystehr,
  candid: CandidApiClient,
  claims: InventoryRecord[]
): Promise<EncounterPackage[]> {
  const promises: Promise<Resource[]>[] = [];
  promises.push(
    getResourcesFromBatchInlineRequests(
      oystehr,
      claims.map(
        (claim) =>
          `Encounter?identifier=${CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM}|${claim.encounterId}&_revinclude=Task:encounter`
      )
    )
  );
  const resourcesResponse = (await Promise.all(promises)).flat();
  const tasks = resourcesResponse.filter(
    (res) =>
      res.resourceType === 'Task' &&
      (res as Task).code?.coding?.some(
        (coding) => coding.system === RCM_TASK_SYSTEM && coding.code === RcmTaskCode.sendInvoiceToPatient
      )
  ) as Task[];

  const result: Omit<EncounterPackage, 'amountCents'>[] = [];
  claims.forEach((claim) => {
    const encounter = resourcesResponse.find(
      (res) =>
        res.resourceType === 'Encounter' && claim.encounterId === getCandidEncounterIdFromEncounter(res as Encounter)
    ) as Encounter;
    if (encounter?.id) {
      const invoiceTask = tasks.find((task) => task.encounter?.reference === createReference(encounter).reference);
      if (!invoiceTask) {
        result.push({ encounter, claim });
      }
    }
  });
  return await populateAmountInPackagesAndFilterZeroAmount(candid, result);
}

async function populateAmountInPackagesAndFilterZeroAmount(
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
  const inventoryPages = await getCandidInventoryPagesRecursive({
    candid,
    claims: [],
    limitPerPage: 100,
    pageCount: 0,
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
