import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Account, Encounter, Patient, Task, TaskOutput } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import {
  BRANDING_CONFIG,
  getPatientReferenceFromAccount,
  getSecret,
  getStripeAccountForAppointmentOrEncounter,
  getStripeCustomerIdFromAccount,
  InvoiceMessagesPlaceholders,
  PATIENT_BILLING_ACCOUNT_TYPE,
  RcmTaskCodings,
  removePrefix,
  replaceTemplateVariablesArrows,
  Secrets,
  SecretsKeys,
} from 'utils';
import { accountMatchesType } from '../../../ehr/shared/harvest';
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
    const { amountCents, dueDate, memo, smsTextMessage } = prefilledInfo;
    console.log('Input task id: ', task.id);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    const stripe = getStripeClient(secrets);

    try {
      console.log('Fetching fhir resources');
      const fhirResources = await getFhirResources(oystehr, encounterId);
      if (!fhirResources) throw new Error('Failed to fetch all needed FHIR resources');
      const { patient, encounter, account } = fhirResources;
      console.log('Fhir resources fetched');

      const stripeAccount = await getStripeAccountForAppointmentOrEncounter({ encounterId }, oystehr);

      console.log('Getting stripe and candid ids');
      const stripeCustomerId = getStripeCustomerIdFromAccount(account, stripeAccount);
      if (!stripeCustomerId) throw new Error('StripeCustomerId is not found');
      const candidEncounterId = getCandidEncounterIdFromEncounter(encounter);
      if (!candidEncounterId) throw new Error('CandidEncounterId is not found');
      console.log('Stripe and candid ids retrieved');

      console.log('Creating invoice and invoice item');
      const patientId = removePrefix('Patient/', encounter.subject?.reference ?? '');
      if (!patientId) throw new Error("Encounter doesn't have patient reference");
      const filledMemo = memo ? fillMessagePlaceholders(memo, amountCents, dueDate) : undefined;
      const invoiceResponse = await createInvoice(stripe, stripeCustomerId, {
        oystEncounterId: encounterId,
        oystPatientId: patientId,
        dueDate,
        filledMemo,
      });
      await createInvoiceItem(stripe, stripeCustomerId, invoiceResponse, amountCents, filledMemo);
      console.log('Invoice and invoice item created');

      console.log('Finalizing invoice');
      const finalized = await stripe.invoices.finalizeInvoice(invoiceResponse.id);
      if (!finalized || finalized.status !== 'open')
        throw new Error(`Failed to finalize invoice, response status: ${finalized.status}`);
      console.log('Invoice finalized: ', finalized.status);

      console.log(`Sending invoice to recipient email recorded in stripe: ${finalized.customer_email}`);
      const sendInvoiceResponse = await stripe.invoices.sendInvoice(invoiceResponse.id);
      console.log('Invoice sent: ', sendInvoiceResponse.status);

      console.log('Filling in invoice sms messages placeholders');
      const invoiceUrl = sendInvoiceResponse.hosted_invoice_url ?? '??';
      const smsMessage = fillMessagePlaceholders(smsTextMessage, amountCents, dueDate, invoiceUrl);

      console.log('Sending sms to patient');
      await sendInvoiceSmsToPatient(oystehr, smsMessage, patient, secrets);
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
  filledMemo?: string
): Promise<Stripe.InvoiceItem> {
  try {
    const invoiceItemParams: Stripe.InvoiceItemCreateParams = {
      customer: stripeCustomerId,
      amount, // cents
      currency: 'usd',
      description: filledMemo,
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
  params: {
    oystEncounterId: string;
    oystPatientId: string;
    filledMemo?: string;
    dueDate: string;
  }
): Promise<Stripe.Invoice> {
  try {
    const { oystEncounterId, oystPatientId, filledMemo, dueDate } = params;

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
  const accounts = response.filter(
    (resource) =>
      resource.resourceType === 'Account' && getPatientReferenceFromAccount(resource as Account)?.includes(patientId)
  ) as Account[];
  const account = accounts.find((account) => accountMatchesType(account, PATIENT_BILLING_ACCOUNT_TYPE));
  console.log('Fhir encounter found: ', encounter.id);
  console.log('Fhir patient found: ', patient.id);
  console.log('Fhir account found', account?.id);
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
  patient: Patient,
  secrets: Secrets | null
): Promise<void> {
  const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  console.log('Sending sms to patient: ', smsTextMessage);
  await sendSmsForPatient(smsTextMessage, oystehr, patient, ENVIRONMENT);
}

function fillMessagePlaceholders(message: string, amountCents: number, dueDate: string, invoiceLink?: string): string {
  const clinic = BRANDING_CONFIG.projectName;
  const params: InvoiceMessagesPlaceholders = {
    clinic,
    amount: (amountCents / 100).toString(),
    'due-date': dueDate,
    'invoice-link': invoiceLink,
  };
  return replaceTemplateVariablesArrows(message, params);
}
