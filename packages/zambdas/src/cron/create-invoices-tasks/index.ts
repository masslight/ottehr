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

type EncounterWithoutTaskPkg = {
  encounter: Encounter;
  patientBalanceInCents: number;
};

interface EncounterPackage {
  encounter: Encounter;
  claim: InventoryRecord;
  tasks?: Task[];
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { secrets } = input;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    const candid = createCandidApiClient(secrets);

    const encountersWithoutATask = await getEncountersWithoutTask(candid, oystehr);
    console.log('encounters without task: ', encountersWithoutATask.length);

    const promises: Promise<void>[] = [];
    encountersWithoutATask.forEach((encounter) => {
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

async function createTaskForEncounter(oystehr: Oystehr, encounterPkg: EncounterWithoutTaskPkg): Promise<void> {
  try {
    const { encounter } = encounterPkg;
    const patientId = encounter.subject?.reference?.replace('Patient/', '');
    if (!patientId) throw new Error('Patient ID not found in encounter: ' + encounter.id);
    const prefilledInvoiceInfo = await getPrefilledInvoiceInfo(encounterPkg.patientBalanceInCents);

    const task: Task = {
      resourceType: 'Task',
      status: 'ready',
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

async function getEncountersWithoutTask(candid: CandidApiClient, oystehr: Oystehr): Promise<EncounterWithoutTaskPkg[]> {
  console.log('getting candid claims');
  const inventoryPages = await getCandidInventoryPagesRecursive({
    candid,
    claims: [],
    limitPerPage: 100,
    pageCount: 0,
    onlyInvoiceable: true,
  });

  const claimsFetched = inventoryPages?.claims;
  console.log('fetched claims: ', claimsFetched?.length);
  if (claimsFetched?.length && claimsFetched.length > 0) {
    console.log('getting itemizations and encounters');
    const [itemizationResponse, encounterPackagesResponse] = await Promise.all([
      getItemizationToClaimIdMap(candid, claimsFetched),
      getEncounterTasksPackages(oystehr, claimsFetched),
    ]);

    console.log('fetched itemizations: ', Object.keys(itemizationResponse).length);
    console.log('fetched encounters: ', encounterPackagesResponse.length);
    const encountersWithoutTask: EncounterWithoutTaskPkg[] = [];
    encounterPackagesResponse.forEach((pkg) => {
      if (!pkg.tasks || pkg.tasks.length === 0) {
        const itemization = itemizationResponse[pkg.claim.claimId];
        const patientBalanceInCents = itemization?.patientBalanceCents;
        if (patientBalanceInCents && patientBalanceInCents > 0) {
          console.log(
            `patient: ${pkg.claim.patientExternalId}, claim: ${pkg.claim.claimId}, oyst encounter: ${pkg.encounter.id} balance (cents): `,
            patientBalanceInCents
          );

          encountersWithoutTask.push({ encounter: pkg.encounter, patientBalanceInCents });
        }
      }
    });
    return encountersWithoutTask;
  }
  return [];
}

async function getItemizationToClaimIdMap(
  candid: CandidApiClient,
  claims: InventoryRecord[]
): Promise<Record<string, InvoiceItemizationResponse>> {
  const itemizationPromises = claims.map((claim) => candid.patientAr.v1.itemize(CandidApi.ClaimId(claim.claimId)));
  const itemizationResponse = await Promise.all(itemizationPromises);

  const itemizationToClaimIdMap: Record<string, InvoiceItemizationResponse> = {};
  itemizationResponse.forEach((res) => {
    if (res && res.ok && res.body) {
      const itemization = res.body as InvoiceItemizationResponse;
      if (itemization.claimId) itemizationToClaimIdMap[itemization.claimId] = itemization;
    }
  });
  return itemizationToClaimIdMap;
}

async function getEncounterTasksPackages(oystehr: Oystehr, claims: InventoryRecord[]): Promise<EncounterPackage[]> {
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

  const result: EncounterPackage[] = [];
  claims.forEach((claim) => {
    const encounter = resourcesResponse.find(
      (res) =>
        res.resourceType === 'Encounter' && claim.encounterId === getCandidEncounterIdFromEncounter(res as Encounter)
    ) as Encounter;
    if (encounter?.id) {
      const encounterTasks = tasks.filter((task) => task.encounter?.reference === createReference(encounter).reference);
      result.push({ encounter, claim, tasks: encounterTasks });
    }
  });
  return result;
}
