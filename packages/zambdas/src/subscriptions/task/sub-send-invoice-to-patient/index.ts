import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CandidApi, CandidApiClient } from 'candidhealth';
import { InvoiceItemizationResponse } from 'candidhealth/api/resources/patientAr/resources/v1';
import { Account, Encounter, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import {
  createCandidApiClient,
  getPatientReferenceFromAccount,
  getSecret,
  getStripeCustomerIdFromAccount,
  PrefilledInvoiceInfo,
  removePrefix,
  replaceTemplateVariablesDollar,
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

const ZAMBDA_NAME = 'send-invoice-to-patient';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParams = validateRequestParameters(input);
    const { secrets, encounterId, prefilledInfo } = validatedParams;

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    const candid = createCandidApiClient(secrets);
    const stripe = getStripeClient(secrets);

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
    const patientBalance = await getPatientBalanceInCentsForClaim({ candid, claimId: candidClaimId });
    if (patientBalance === undefined)
      throw new Error('Patient balance is undefined for this claim, claim id: ' + candidClaimId);
    console.log('Patient balance retrieved');

    console.log('Creating invoice and invoice item');
    const patientId = removePrefix('Patient/', encounter.subject?.reference ?? '');
    if (!patientId) throw new Error("Encounter don't have patient reference");
    const invoiceResponse = await createInvoice(stripe, stripeCustomerId, {
      oystEncounterId: encounterId,
      oystPatientId: patientId,
      prefilledInfo,
    });
    await createInvoiceItem(stripe, stripeCustomerId, invoiceResponse, patientBalance, prefilledInfo);
    console.log('Invoice and invoice item created');

    console.log('Sending invoice to patient (with email)');
    const sendInvoiceResponse = await stripe.invoices.sendInvoice(invoiceResponse.id);
    console.log('Invoice sent: ', sendInvoiceResponse.status);

    console.log('Sending sms to patient');
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
    const smsMessage = replaceTemplateVariablesDollar(prefilledInfo.smsTextMessage, {
      invoiceLink: 'link will be here', // todo place link here
    });
    await sendSmsForPatient(smsMessage, oystehr, patient, ENVIRONMENT);
    console.log('Sms sent to patient');

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Invoice created and sent successfully' }),
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
      // amount, // cents
      amount: 100, // todo remove this it's for testing needs
      currency: 'usd',
      description: memo, // ??
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
    prefilledInfo: PrefilledInvoiceInfo;
  }
): Promise<Stripe.Invoice> {
  try {
    const { oystEncounterId, oystPatientId, prefilledInfo } = params;
    const { memo, dueDate } = prefilledInfo;

    const invoiceParams: Stripe.InvoiceCreateParams = {
      customer: stripeCustomerId,
      collection_method: 'send_invoice',
      description: memo,
      metadata: {
        oystehr_patient_id: oystPatientId,
        oystehr_encounter_id: oystEncounterId,
      },
      currency: 'USD',
      due_date: DateTime.fromISO(dueDate).toUnixInteger(), // ???
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
      'Candid encounter claims statuses: ',
      candidEncounterResponse.claims.map((claim) => claim.status)
    );
    // todo what i'm suppose to get here as claim id? i have array of claims with statuses
    // return candidEncounterResponse.claims.find((claim) => claim.status === CandidApi.ClaimStatus.BillerReceived)
    //   ?.claimId;
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
    console.error("Encounter don't have patient reference");
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
