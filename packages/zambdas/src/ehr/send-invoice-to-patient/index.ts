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
  SecretsKeys,
  SendInvoiceToPatientZambdaInput,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getCandidEncounterIdFromEncounter,
  getStripeClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'send-invoice-to-patient';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParams = validateRequestParameters(input);
    const { secrets, oystPatientId, oystEncounterId } = validatedParams;

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    const candid = createCandidApiClient(secrets);
    const stripe = getStripeClient(secrets);

    const fhirResources = await getFhirResources(oystehr, oystPatientId, oystEncounterId);
    if (!fhirResources) throw new Error('Failed to fetch all needed FHIR resources');
    const stripeCustomerId = getStripeCustomerIdFromAccount(fhirResources.account);
    if (!stripeCustomerId) throw new Error('StripeCustomerId is not found');
    const candidEncounterId = getCandidEncounterIdFromEncounter(fhirResources.encounter);
    if (!candidEncounterId) throw new Error('CandidEncounterId is not found');
    const candidClaimId = await getCandidClaimIdFromCandidEncounterId(candid, candidEncounterId);
    if (!candidClaimId) throw new Error('CandidClaimId is not found');

    const patientBalance = await getPatientBalanceInCentsForClaim({ candid, claimId: candidClaimId });
    if (patientBalance === undefined)
      throw new Error('Patient balance is undefined for this claim, claim id: ' + candidClaimId);
    const response = await createInvoice(stripe, stripeCustomerId, patientBalance, validatedParams);
    if (!response || !response.id) throw new Error('Failed to create invoice');
    console.log('Invoice created: ', response.id);
    const sendInvoiceResponse = await stripe.invoices.sendInvoice(response.id);
    console.log('Invoice sent: ', sendInvoiceResponse.status);

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

async function createInvoice(
  stripe: Stripe,
  stripeCustomerId: string,
  amount: number,
  params: SendInvoiceToPatientZambdaInput
): Promise<Stripe.Invoice> {
  const { oystPatientId, oystEncounterId, prefilledInfo } = params;
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
  console.log('Invoice created: ', invoiceResponse.id);

  const invoiceItemParams: Stripe.InvoiceItemCreateParams = {
    customer: stripeCustomerId,
    // amount, // cents
    amount: 100,
    currency: 'usd',
    description: memo, // ??
    invoice: invoiceResponse.id, // force add current invoiceItem to previously created invoice
  };
  const invoiceItemResponse = await stripe.invoiceItems.create(invoiceItemParams);
  console.log('Invoice item created: ', invoiceItemResponse.id);

  return invoiceResponse;
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
  patientId: string,
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
