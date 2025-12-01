import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CandidApi, CandidApiClient } from 'candidhealth';
import { InventoryRecord, InvoiceItemizationResponse } from 'candidhealth/api/resources/patientAr/resources/v1';
import { Account, Encounter, Patient, RelatedPerson, Resource, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  createCandidApiClient,
  createReference,
  getActiveAccountGuarantorReference,
  getCandidInventoryPagesRecursive,
  getEmailForIndividual,
  getFullName,
  getPatientReferenceFromAccount,
  getPhoneNumberForIndividual,
  getResourcesFromBatchInlineRequests,
  getSecret,
  getSMSNumberForIndividual,
  mapGenderToLabel,
  PrefilledInvoiceInfo,
  RCM_TASK_SYSTEM,
  RcmTaskCode,
  RcmTaskCodings,
  SecretsKeys,
  takeContainedOrFind,
  textingConfig,
} from 'utils';
import { createInvoiceTaskInput } from 'utils/lib/helpers/tasks/invoices-tasks';
import {
  CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM,
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getCandidEncounterIdFromEncounter,
  getRelatedPersonForPatient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';

let m2mToken: string;

const ZAMBDA_NAME = 'sub-create-invoices-tasks';

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

async function getPrefilledInvoiceInfo(
  oystehr: Oystehr,
  patientId: string,
  encounterPkgs: EncounterWithoutTaskPkg
): Promise<PrefilledInvoiceInfo> {
  try {
    const { patientBalanceInCents } = encounterPkgs;
    const patientResources = await getFhirPatientResources({ oystehr, patientId });
    if (!patientResources) throw new Error(`Patient resources not found for patient: ${patientId}`);
    const { patient, responsibleParty, patientPhoneNumber } = patientResources;

    const patientName = getFullName(patient);
    const patientDob = patient?.birthDate
      ? DateTime.fromISO(patient.birthDate)?.toFormat('MM/dd/yyyy')?.toString()
      : undefined; // todo what's here?
    const patientGenderLabel = patient?.gender && mapGenderToLabel[patient.gender];

    const responsiblePartyName = getFullName(responsibleParty);
    const responsiblePartyPhoneNumber = getPhoneNumberForIndividual(responsibleParty);
    const responsiblePartyEmail = getEmailForIndividual(responsibleParty);

    const smsMessageFromSecret = textingConfig.invoicing.smsMessage;
    const memoFromSecret = textingConfig.invoicing.stripeMemoMessage;
    const dueDateFromSecret = textingConfig.invoicing.dueDateInDays;
    const dueDate = DateTime.now().plus({ days: dueDateFromSecret }).toISODate();

    if (!patientDob) throw new Error('Date of birth was not found for patient');
    if (!responsiblePartyEmail) throw new Error('Email was not found for responsible party');
    return {
      patientFullName: patientName,
      patientDob: patientDob,
      patientPhoneNumber,
      patientGender: patientGenderLabel ?? '',
      responsiblePartyName,
      responsiblePartyPhoneNumber: responsiblePartyPhoneNumber ?? '', // todo: verify what fields will be here in different responsible party modes?
      responsiblePartyEmail,
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
    const prefilledInvoiceInfo = await getPrefilledInvoiceInfo(oystehr, patientId, encounterPkg);

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

type EncounterWithoutTaskPkg = {
  encounter: Encounter;
  patientBalanceInCents: number;
};

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
    const [itemizationResponse, encounterPackagesResponse] = await Promise.all([
      getItemizationToClaimIdMap(candid, claimsFetched),
      getEncounterTasksPackages(oystehr, claimsFetched),
    ]);

    const encountersWithoutTask: EncounterWithoutTaskPkg[] = [];
    encounterPackagesResponse.forEach((pkg) => {
      if (!pkg.tasks || pkg.tasks.length === 0) {
        const itemization = itemizationResponse[pkg.claim.claimId];
        const patientBalanceInCents = itemization?.patientBalanceCents;
        if (patientBalanceInCents && patientBalanceInCents > 0) {
          console.log(
            `patient: ${pkg.claim.patientExternalId}, claim: ${pkg.claim.claimId}, oyst encounter: ${pkg.encounter.id} balance: `,
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

interface EncounterPackage {
  encounter: Encounter;
  claim: InventoryRecord;
  tasks?: Task[];
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

async function getFhirPatientResources(input: {
  oystehr: Oystehr;
  patientId: string;
}): Promise<{ patient: Patient; responsibleParty: RelatedPerson; patientPhoneNumber: string } | undefined> {
  const { patientId, oystehr } = input;
  try {
    console.log('🔍 Fetching FHIR resources for invoiceable patients...');

    const [resourcesResponse, relatedPerson] = await Promise.all([
      oystehr.fhir.search({
        resourceType: 'Patient',
        params: [
          {
            name: '_id',
            value: patientId,
          },
          {
            name: '_revinclude',
            value: 'Account:patient',
          },
        ],
      }),
      getRelatedPersonForPatient(patientId, oystehr),
    ]);
    const resources = resourcesResponse.unbundle();
    console.log('Fetched FHIR resources:', resources.length);

    const patient = resources.find((resource) => resource.resourceType === 'Patient') as Patient;
    const account = resources.find(
      (resource) =>
        resource.resourceType === 'Account' && getPatientReferenceFromAccount(resource as Account)?.includes(patientId)
    ) as Account;
    if (!patient || !account) return undefined;

    if (!relatedPerson) throw new Error(`No related person found for patient: ${patientId}`);
    const patientPhoneNumber = getSMSNumberForIndividual(relatedPerson);
    if (!patientPhoneNumber) throw new Error(`No verified phone number found for patient: ${patientId}`);

    const responsiblePartyRef = getActiveAccountGuarantorReference(account);
    if (!responsiblePartyRef) throw new Error(`No responsible party reference found for account: ${account.id}`);
    const responsibleParty = takeContainedOrFind(responsiblePartyRef, resources as Resource[], account) as
      | RelatedPerson
      | undefined;
    if (!responsibleParty) throw new Error(`No responsible party found for account: ${account.id}`);

    return { patient, responsibleParty, patientPhoneNumber };
  } catch (error) {
    const errorMessage = `Error fetching FHIR resources for patient ${patientId}: ${error}`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}
