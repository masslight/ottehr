import { APIGatewayProxyResult } from 'aws-lambda';
import { CandidApi, CandidApiClient } from 'candidhealth';
import { InvoiceItemizationResponse } from 'candidhealth/api/resources/patientAr/resources/v1';
import Stripe from 'stripe';
import { createCandidApiClient, getSecret, SecretsKeys, SendInvoiceToPatientZambdaInput } from 'utils';
import { checkOrCreateM2MClientToken, getStripeClient, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'send-invoice-to-patient';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParams = validateRequestParameters(input);
    const { secrets } = validatedParams;

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    // const oystehr = createOystehrClient(m2mToken, secrets);
    const candid = createCandidApiClient(secrets);
    const stripe = getStripeClient(secrets);

    const patientBalance = await getPatientBalanceInCentsForClaim({ candid, claimId: validatedParams.candidClaimId });
    if (patientBalance === undefined)
      throw new Error('Patient balance is undefined for this claim, claim id: ' + validatedParams.candidClaimId);
    const response = await createInvoice(stripe, patientBalance, validatedParams);
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
  amount: number,
  params: SendInvoiceToPatientZambdaInput
): Promise<Stripe.Invoice> {
  const { oystPatientId, oystEncounterId, stripePatientId, prefilledInfo } = params;
  const { memo } = prefilledInfo;
  const invoiceItemParams: Stripe.InvoiceItemCreateParams = {
    customer: stripePatientId,
    amount, // cents
    currency: 'usd',
    description: memo, // ??
  };
  await stripe.invoiceItems.create(invoiceItemParams);

  const invoiceParams: Stripe.InvoiceCreateParams = {
    customer: stripePatientId,
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
