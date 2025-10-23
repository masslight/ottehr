import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CandidApi, CandidApiClient } from 'candidhealth';
import { InvoiceItemizationResponse } from 'candidhealth/api/resources/patientAr/resources/v1';
import { Account, Encounter, Patient } from 'fhir/r4b';
import Stripe from 'stripe';
import {
  createCandidApiClient,
  getCandidClaimIdFromEncounter,
  getPatientReferenceFromAccount,
  getSecret,
  getStripeCustomerIdFromAccount,
  SecretsKeys,
  SendInvoiceToPatientZambdaInput,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
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
    const stripeCustomerId = getStripeCustomerIdFromAccount(fhirResources.account);
    const candidClaimId = getCandidClaimIdFromEncounter(fhirResources.encounter);
    if (!stripeCustomerId || !candidClaimId) throw new Error('StripeCustomerId or CandidClaimId is not found');

    const patientBalance = await getPatientBalanceInCentsForClaim({ candid, claimId: candidClaimId });
    if (patientBalance === undefined)
      throw new Error('Patient balance is undefined for this claim, claim id: ' + candidClaimId);
    const response = await createInvoice(stripe, stripeCustomerId, patientBalance, validatedParams);
    console.log('Invoice created: ', response.id);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Invoice created successfully' }),
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
  const { memo } = prefilledInfo;
  const invoiceItemParams: Stripe.InvoiceItemCreateParams = {
    customer: stripeCustomerId,
    amount, // cents
    currency: 'usd',
    description: memo, // ??
  };
  await stripe.invoiceItems.create(invoiceItemParams);

  const invoiceParams: Stripe.InvoiceCreateParams = {
    customer: stripeCustomerId,
    collection_method: 'send_invoice',
    description: memo,
    metadata: {
      oystehr_patient_id: oystPatientId,
      oystehr_encounter_id: oystEncounterId,
    },
    currency: 'USD',
    due_date: 2, // days since invoice created
  };
  return await stripe.invoices.create(invoiceParams);
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
): Promise<{ patient: Patient; encounter: Encounter; account: Account }> {
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
  if (!encounter || !patient || !account) throw new Error('Encounter, patient, or account not found');

  return {
    encounter,
    patient,
    account,
  };
}
