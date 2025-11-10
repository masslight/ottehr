import Oystehr from '@oystehr/sdk';
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
  PrefilledInvoiceInfo,
  RCM_TASK_SYSTEM,
  RcmTaskCode,
  RcmTaskCodings,
  Secrets,
  SecretsKeys,
  takeContainedOrFind,
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
      promises.push(createTaskForEncounter(oystehr, encounter, secrets));
    });
    await Promise.all(promises);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully created tasks for encounters' }),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
    console.log('Error occurred:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
});

async function getPrefilledInvoiceInfo(
  oystehr: Oystehr,
  patientId: string,
  secrets: Secrets | null
): Promise<PrefilledInvoiceInfo> {
  try {
    const fhirResources = await getFhirPatientAndResponsibleParty({ oystehr, patientId });
    const smsMessageFromSecret = getSecret(SecretsKeys.INVOICING_DEFAULT_SMS_MESSAGE, secrets);
    const memoFromSecret = getSecret(SecretsKeys.INVOICING_DEFAULT_MEMO_MESSAGE, secrets);
    const dueDateFromSecret = getSecret(SecretsKeys.INVOICING_DEFAULT_DUE_DATE_IN_DAYS, secrets);
    if (fhirResources) {
      const { responsibleParty } = fhirResources;
      const email = getEmailForIndividual(responsibleParty);
      const phoneNumber = getPhoneNumberForIndividual(responsibleParty);
      if (!email || !phoneNumber) throw new Error('Email or phone number not found for responsible party');
      return {
        recipientName: getFullName(responsibleParty),
        recipientEmail: email,
        recipientPhoneNumber: phoneNumber,
        smsTextMessage: smsMessageFromSecret,
        memo: memoFromSecret,
        dueDate: DateTime.now()
          .plus({ days: parseInt(dueDateFromSecret) })
          .toISODate(),
      };
    }
    throw new Error(`Prefilled info cannot be filled for patient: ${patientId}`);
  } catch (error) {
    console.error('Error fetching prefilled invoice info: ', error);
    throw new Error('Error fetching prefilled invoice info: ' + error);
  }
}

async function createTaskForEncounter(oystehr: Oystehr, encounter: Encounter, secrets: Secrets | null): Promise<void> {
  try {
    const patientId = encounter.subject?.reference?.replace('Patient/', '');
    if (!patientId) throw new Error('Patient ID not found in encounter: ' + encounter.id);
    const prefilledInvoiceInfo = await getPrefilledInvoiceInfo(oystehr, patientId, secrets);

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
    console.error(`Error creating task for encounter (${encounter.id}): `, error);
  }
}

async function getEncountersWithoutTask(candid: CandidApiClient, oystehr: Oystehr): Promise<Encounter[]> {
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

    const encountersWithoutTask: Encounter[] = [];
    encounterPackagesResponse.forEach((pkg) => {
      if (!pkg.tasks || pkg.tasks.length === 0) {
        const itemization = itemizationResponse[pkg.claim.claimId];
        console.log(
          `patient: ${pkg.claim.patientExternalId} claim: ${pkg.claim.claimId} balance: `,
          itemization.patientBalanceCents / 100
        );
        if (itemization.patientBalanceCents > 0) {
          encountersWithoutTask.push(pkg.encounter);
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

async function getFhirPatientAndResponsibleParty(input: {
  oystehr: Oystehr;
  patientId: string;
}): Promise<{ patient: Patient; responsibleParty: RelatedPerson } | undefined> {
  try {
    const { patientId, oystehr } = input;
    console.log('🔍 Fetching FHIR resources for invoiceable patients...');

    const resources = (
      await oystehr.fhir.search({
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
      })
    ).unbundle();
    console.log('Fetched FHIR resources:', resources.length);
    const patient = resources.find((resource) => resource.resourceType === 'Patient') as Patient;
    const account = resources.find(
      (resource) =>
        resource.resourceType === 'Account' && getPatientReferenceFromAccount(resource as Account)?.includes(patientId)
    ) as Account;
    if (!patient || !account) return undefined;
    const responsiblePartyRef = getActiveAccountGuarantorReference(account);
    if (responsiblePartyRef) {
      const responsibleParty = takeContainedOrFind(responsiblePartyRef, resources as Resource[], account) as
        | RelatedPerson
        | undefined;
      if (patient && responsibleParty) {
        return { patient, responsibleParty };
      }
    }
    return undefined;
  } catch (error) {
    console.error('Error fetching fhir resources: ', error);
    throw new Error('Error fetching fhir resources: ' + error);
  }
}
