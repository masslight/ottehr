import Oystehr from '@oystehr/sdk';
import { CandidApi, CandidApiClient, CandidApiEnvironment } from 'candidhealth';
import { InventoryRecord, InvoiceItemizationResponse } from 'candidhealth/api/resources/patientAr/resources/v1';
import { Encounter, Task } from 'fhir/r4b';
import fs from 'fs';
import { DateTime } from 'luxon';
import {
  createInvoiceTaskInput,
  createReference,
  getCandidInventoryPagesRecursive,
  getResourcesFromBatchInlineRequests,
  PrefilledInvoiceInfo,
  RcmTaskCodings,
  textingConfig,
} from 'utils';
import { CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM, getCandidEncounterIdFromEncounter } from 'zambdas/src/shared';

const pendingTaskStatus: Task['status'] = 'ready';

async function createOyst(zambdaEnv: Record<string, string>, token: string): Promise<Oystehr> {
  const oystehr = new Oystehr({
    accessToken: token,
    projectId: zambdaEnv.PROJECT_ID,
    services: {
      fhirApiUrl: zambdaEnv.FHIR_API,
      projectApiUrl: zambdaEnv.PROJECT_API,
    },
  });
  console.log(`Created Oystehr client`);
  return oystehr;
}

async function createCandid(
  zambdaEnv: Record<string, string>,
  candidEnv: CandidApiEnvironment
): Promise<CandidApiClient> {
  const candidClientId = zambdaEnv.CANDID_CLIENT_ID || '';
  const candidClientSecret = zambdaEnv.CANDID_CLIENT_SECRET || '';
  console.log(`Creating Candid client`);

  return new CandidApiClient({
    clientId: candidClientId,
    clientSecret: candidClientSecret,
    environment: candidEnv,
  });
}

async function main(): Promise<void> {
  const environment = 'testing';
  const candidEnv = CandidApiEnvironment.Staging;
  const maxCandidPages = 18;
  const startFrom = DateTime.fromFormat('01/14/2026', 'MM/dd/yyyy');
  const endOn = startFrom.plus({ weeks: 2 });
  const token =
    'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlRRc2xGbWlRX01ZTzg4Z3BRUnlvRCJ9.eyJpc3MiOiJodHRwczovL2F1dGguemFwZWhyLmNvbS8iLCJzdWIiOiJhdXRoMHw2NzU3NTM3NTRhYWY3OGU0NTllOWQ4OTMiLCJhdWQiOlsiaHR0cHM6Ly9hcGkuemFwZWhyLmNvbSIsImh0dHBzOi8vemFwZWhyLnVzLmF1dGgwLmNvbS91c2VyaW5mbyJdLCJpYXQiOjE3NjkxMDk0MDAsImV4cCI6MTc2OTE5NTgwMCwic2NvcGUiOiJvcGVuaWQgcHJvZmlsZSBlbWFpbCBvZmZsaW5lX2FjY2VzcyIsImF6cCI6Im8zcnN6bDJuS0k2STFhSDZzYmw4ZEZyRmdNVkcyaU1jIn0.DrdnUe4pXDk_aAi2IUYz_xXDdevk8V2fN8NPqWTcL7W4_n1nh3F6-e_XLCau1nY9xlEpoEJC0SAIIi5S8sHqEgMvpIkDeRkLN3heyX_UlC8vHwB4s1mACCJJlhEVwU2-BSurj0VIOo4Cyra14eagN6J8_n72KP9VlGoBHsOt_FVswWpw1SnRvHZERIiuDhlJOD8Adklu5aulRL3q_ycWT9KPDRPCxqS1vMC3b8XCj2VOGMhSY9NQKyKNoZltgOojfS72D640DlqKwGvsbZIedtKjZa9pp4BEtHyf2Xchfs-87uG1VDaYReB6AwO1WbkW2rTgwVrMhYokFjBFxTzrUw';

  console.log(`Reading environment variables from packages/zambdas/.env/${environment}.json.`);
  const zambdaEnv: Record<string, string> = JSON.parse(
    fs.readFileSync(`packages/zambdas/.env/${environment}.json`, 'utf8')
  );
  const oystehr = await createOyst(zambdaEnv, token);
  const candid = await createCandid(zambdaEnv, candidEnv);

  let candidClaims = await getAllCandidClaims(candid, startFrom, maxCandidPages);

  candidClaims = candidClaims.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  candidClaims = candidClaims.filter((claim) => DateTime.fromJSDate(claim.timestamp) <= endOn);

  const firstDate = DateTime.fromJSDate(candidClaims[0].timestamp).toFormat('MM/dd/yyyy') ?? '';
  const lastDate = DateTime.fromJSDate(candidClaims.at(-1).timestamp).toFormat('MM/dd/yyyy') ?? '';
  console.log(`Found ${candidClaims.length} claims between ${firstDate} and ${lastDate}`);

  const pkgs = await getEncountersWithoutTaskFhir(oystehr, candid, candidClaims);
  console.log('Encounters without a task and positive amount: ', pkgs.length);

  const promises: Promise<void>[] = [];
  pkgs.forEach((encounter) => {
    promises.push(createTaskForEncounter(oystehr, encounter));
  });
  await Promise.all(promises);
}

interface EncounterPackage {
  encounter: Encounter;
  claim: InventoryRecord;
  invoiceTask?: Task;
  amountCents: number;
}

async function getEncountersWithoutTaskFhir(
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

  console.log('Getting amounts for encounters and filtering zero amounts:');
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
  return await populateAmountInPackagesAndFilterZeroAmount(candid, result);
}

async function populateAmountInPackagesAndFilterZeroAmount(
  candid: CandidApiClient,
  packages: Omit<EncounterPackage, 'amountCents' | 'invoiceTask'>[]
): Promise<EncounterPackage[]> {
  const itemizationPromises = packages.map((pkg) => candid.patientAr.v1.itemize(CandidApi.ClaimId(pkg.claim.claimId)));
  const itemizationResponse = await Promise.all(itemizationPromises);

  const resultPackages: EncounterPackage[] = [];
  itemizationResponse.forEach((res) => {
    if (res && res.ok && res.body) {
      const itemization = res.body as InvoiceItemizationResponse;
      const packageFound = packages.find((pkg) => pkg.claim.claimId === itemization.claimId);
      if (
        itemization.claimId &&
        itemization.patientBalanceCents &&
        itemization.patientBalanceCents > 0 &&
        packageFound
      ) {
        resultPackages.push({
          ...packageFound,
          amountCents: itemization.patientBalanceCents,
        });
      }
    }
  });
  return resultPackages;
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
      authoredOn: DateTime.now().toISO(),
      input: createInvoiceTaskInput(prefilledInvoiceInfo),
    };

    const created = await oystehr.fhir.create(task);
    console.log('Created task: ', created.id);
  } catch (error) {
    console.log(`Error creating task: ${error}, ${JSON.stringify(error)}`);
    // captureException(error);
  }
}

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

async function getAllCandidClaims(
  candid: CandidApiClient,
  sinceDate: DateTime,
  maxPages?: number
): Promise<InventoryRecord[]> {
  const inventoryPages = await getCandidInventoryPagesRecursive({
    candid,
    claims: [],
    limitPerPage: 100,
    pageCount: 0,
    maxPages,
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

main().catch((error) => {
  console.log('Error: ', error);
});
