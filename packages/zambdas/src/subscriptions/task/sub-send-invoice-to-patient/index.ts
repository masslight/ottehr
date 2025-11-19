import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CandidApi, CandidApiClient } from 'candidhealth';
import { InvoiceItemizationResponse } from 'candidhealth/api/resources/patientAr/resources/v1';
import { Operation } from 'fast-json-patch';
import { Account, Encounter, Patient, Task, TaskOutput } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import {
  BRANDING_CONFIG,
  createCandidApiClient,
  getPatientReferenceFromAccount,
  getSecret,
  getStripeCustomerIdFromAccount,
  PrefilledInvoiceInfo,
  RcmTaskCodings,
  removePrefix,
  replaceTemplateVariablesArrows,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getCandidEncounterIdFromEncounter,
  getStripeClient,
  sendSmsForPatient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'sub-send-invoice-to-patient';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParams = validateRequestParameters(input);
    const { secrets, encounterId, prefilledInfo, task } = validatedParams;
    console.log('Input task id: ', task.id);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    const candid = createCandidApiClient(secrets);
    const stripe = getStripeClient(secrets);

    try {
      const clinicName = BRANDING_CONFIG.projectName;

      console.log('Fetching fhir resources');
      const fhirResources = await getFhirResources(oystehr, encounterId);
      if (!fhirResources) throw new Error('Failed to fetch all needed FHIR resources');
      const { patient, encounter, account } = fhirResources;
      console.log('Fhir resources fetched');

      console.log('Getting stripe and candid ids');
      const stripeCustomerId = getStripeCustomerIdFromAccount(account);
      if (!stripeCustomerId) throw new Error('StripeCustomerId is not found');
      const candidEncounterId = getCandidEncounterIdFromEncounter(encounter);
      if (!candidEncounterId) throw new Error('CandidEncounterId is not found');
      const candidClaimId = await getCandidClaimIdFromCandidEncounterId(candid, candidEncounterId);
      if (!candidClaimId) throw new Error('CandidClaimId is not found');
      console.log('Stripe and candid ids retrieved');

      console.log('Getting patient balance');
      const patientBalanceCents = await getPatientBalanceInCentsForClaim({ candid, claimId: candidClaimId });
      if (patientBalanceCents === undefined)
        throw new Error('Patient balance is undefined for this claim, claim id: ' + candidClaimId);
      console.log('Patient balance retrieved');

      console.log('Creating invoice and invoice item');
      const patientId = removePrefix('Patient/', encounter.subject?.reference ?? '');
      if (!patientId) throw new Error("Encounter doesn't have patient reference");
      const invoiceResponse = await createInvoice(stripe, stripeCustomerId, clinicName, {
        oystEncounterId: encounterId,
        oystPatientId: patientId,
        prefilledInfo,
      });
      await createInvoiceItem(stripe, stripeCustomerId, invoiceResponse, patientBalanceCents, prefilledInfo);
      console.log('Invoice and invoice item created');

      console.log('Sending invoice to patient (with email)');
      const sendInvoiceResponse = await stripe.invoices.sendInvoice(invoiceResponse.id);
      console.log('Invoice sent: ', sendInvoiceResponse.status);

      console.log('Sending sms to patient');
      const invoiceUrl = sendInvoiceResponse.hosted_invoice_url ?? '??';
      await sendInvoiceSmsToPatient(
        oystehr,
        prefilledInfo.smsTextMessage,
        invoiceUrl,
        clinicName,
        (patientBalanceCents / 100).toString(),
        prefilledInfo.dueDate,
        patient,
        secrets
      );
      console.log('Sms sent to patient');

      console.log('Setting task status to completed');
      const taskCopy = addInvoiceIdToTaskOutput(task, invoiceResponse.id);
      await updateTaskStatusAndOutput(oystehr, task, 'completed', taskCopy.output);
      console.log('Task status and output updated');
    } catch (error) {
      const oystehr = createOystehrClient(m2mToken, secrets);
      console.log('updating task status to failed and output');
      const taskCopy = addErrorToTaskOutput(task, error instanceof Error ? error.message : 'Unknown error');
      await updateTaskStatusAndOutput(oystehr, task, 'failed', taskCopy.output);
      throw error;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Invoice created and sent successfully' }),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    console.log('Error occurred:', error);
    return await topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

async function createInvoiceItem(
  stripe: Stripe,
  stripeCustomerId: string,
  invoice: Stripe.Invoice,
  amount: number,
  params: PrefilledInvoiceInfo
): Promise<Stripe.InvoiceItem> {
  try {
    const { memo } = params;

    const invoiceItemParams: Stripe.InvoiceItemCreateParams = {
      customer: stripeCustomerId,
      amount, // cents
      currency: 'usd',
      description: memo,
      invoice: invoice.id, // force add current invoiceItem to previously created invoice
    };
    const invoiceItemResponse = await stripe.invoiceItems.create(invoiceItemParams);
    if (!invoiceItemResponse || !invoiceItemResponse.id) throw new Error('Failed to create invoiceItem');

    return invoiceItemResponse;
  } catch (error) {
    console.error('Error creating invoice item:', error);
    throw error;
  }
}

async function createInvoice(
  stripe: Stripe,
  stripeCustomerId: string,
  clinic: string,
  params: {
    oystEncounterId: string;
    oystPatientId: string;
    prefilledInfo: PrefilledInvoiceInfo;
  }
): Promise<Stripe.Invoice> {
  try {
    const { oystEncounterId, oystPatientId, prefilledInfo } = params;
    const { memo, dueDate } = prefilledInfo;
    const filledMemo = memo
      ? replaceTemplateVariablesArrows(memo, {
          clinic,
          'due-date': dueDate,
        })
      : memo;

    const invoiceParams: Stripe.InvoiceCreateParams = {
      customer: stripeCustomerId,
      collection_method: 'send_invoice',
      description: filledMemo,
      metadata: {
        oystehr_patient_id: oystPatientId,
        oystehr_encounter_id: oystEncounterId,
      },
      currency: 'USD',
      due_date: DateTime.fromISO(dueDate).toUnixInteger(),
      pending_invoice_items_behavior: 'exclude', // Start with a blank invoice
      auto_advance: false, // Ensure it stays a draft
    };
    const invoiceResponse = await stripe.invoices.create(invoiceParams);
    if (!invoiceResponse || !invoiceResponse.id) throw new Error('Failed to create invoice');

    return invoiceResponse;
  } catch (error) {
    console.error('Error creating invoice:', error);
    throw error;
  }
}

async function getCandidClaimIdFromCandidEncounterId(
  candid: CandidApiClient,
  candidEncounterId: string
): Promise<string | undefined> {
  const candidEncounter = await candid.encounters.v4.get(CandidApi.EncounterId(candidEncounterId));
  if (candidEncounter && candidEncounter.ok && candidEncounter.body) {
    const candidEncounterResponse = candidEncounter.body;
    console.log(
      `Candid encounter ${candidEncounterId} claims statuses: `,
      candidEncounterResponse.claims.map((claim) => claim.status)
    );
    // Candid patientArStatus statuses are really tricky, and it's hard to say if claim status affect inventory-claim.patientArStatus being 'invoiceable' or 'non-invoiceable'
    // since we already have this claim as invoiceable in create-invoices-tasks and i don't think we are creating few claims for the same encounter
    // this part is ok
    return candidEncounterResponse.claims[0]?.claimId;
  }
  return undefined;
}

async function getPatientBalanceInCentsForClaim(input: {
  candid: CandidApiClient;
  claimId: string;
}): Promise<number | undefined> {
  const { candid, claimId } = input;
  const itemizationResponse = await candid.patientAr.v1.itemize(CandidApi.ClaimId(claimId));
  if (itemizationResponse && itemizationResponse.ok && itemizationResponse.body) {
    const itemization = itemizationResponse.body as InvoiceItemizationResponse;
    return itemization.patientBalanceCents;
  }
  return undefined;
}

async function getFhirResources(
  oystehr: Oystehr,
  encounterId: string
): Promise<{ patient: Patient; encounter: Encounter; account: Account } | undefined> {
  const response = (
    await oystehr.fhir.search({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: encounterId,
        },
        {
          name: '_include',
          value: 'Encounter:patient',
        },
        {
          name: '_revinclude:iterate',
          value: 'Account:patient',
        },
      ],
    })
  ).unbundle();

  const encounter = response.find((resource) => resource.resourceType === 'Encounter') as Encounter;
  const patientId = removePrefix('Patient/', encounter.subject?.reference ?? '');
  if (!patientId) {
    console.error("Encounter doesn't have patient reference");
    return undefined;
  }
  const patient = response.find(
    (resource) => resource.resourceType === 'Patient' && resource.id === patientId
  ) as Patient;
  const account = response.find(
    (resource) =>
      resource.resourceType === 'Account' && getPatientReferenceFromAccount(resource as Account)?.includes(patientId)
  ) as Account;
  console.log('Fhir encounter found: ', encounter.id);
  console.log('Fhir patient found: ', patient.id);
  console.log('Fhir account found', account.id);
  if (!encounter || !patient || !account) return undefined;

  return {
    encounter,
    patient,
    account,
  };
}

async function updateTaskStatusAndOutput(
  oystehr: Oystehr,
  task: Task,
  status: Task['status'],
  newOutput?: TaskOutput[]
): Promise<void> {
  const patchOperations: Operation[] = [
    {
      op: 'replace',
      path: '/status',
      value: status,
    },
  ];
  if (newOutput) {
    patchOperations.push({
      op: task.output ? 'replace' : 'add',
      path: '/output',
      value: newOutput,
    });
  }
  await oystehr.fhir.patch({
    resourceType: 'Task',
    id: task.id!,
    operations: patchOperations,
  });
}

function addInvoiceIdToTaskOutput(task: Task, invoiceId: string): Task {
  const taskCopy = { ...task };
  if (!taskCopy.output) taskCopy.output = [];
  const invoiceIdCoding = RcmTaskCodings.sendInvoiceOutputInvoiceId;

  const existingInvoiceId = taskCopy.output.find((output) => output.valueString === invoiceId);
  if (existingInvoiceId) {
    return taskCopy;
  } else {
    const newInvoiceId: TaskOutput = {
      type: invoiceIdCoding,
      valueString: invoiceId,
    };
    taskCopy.output?.push(newInvoiceId);
    return taskCopy;
  }
}

function addErrorToTaskOutput(task: Task, error: string): Task {
  const taskCopy = { ...task };
  if (!taskCopy.output) taskCopy.output = [];
  const taskError = RcmTaskCodings.sendInvoiceOutputError;

  taskCopy.output?.push({
    type: taskError,
    valueString: error,
  });
  return taskCopy;
}

async function sendInvoiceSmsToPatient(
  oystehr: Oystehr,
  smsTextMessage: string,
  invoiceUrl: string,
  clinic: string,
  amount: string,
  dueDate: string,
  patient: Patient,
  secrets: Secrets | null
): Promise<void> {
  const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  const smsMessage = replaceTemplateVariablesArrows(smsTextMessage, {
    clinic,
    amount,
    'due-date': dueDate,
    'invoice-link': invoiceUrl,
  });
  console.log('Sending sms to patient: ', smsMessage);
  await sendSmsForPatient(smsMessage, oystehr, patient, ENVIRONMENT);
}
