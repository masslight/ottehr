import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Invoice } from 'fhir/r4b';
import Stripe from 'stripe';
import { GetBillingInvoiceInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { SetupBillingNioInvoiceCardResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { getStripeClient } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { ensureOrganizationStripeCustomerId, resolveInvoiceStripePayer } from '../invoice-stripe';
import { createBillingClient, fetchById } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'setup-billing-nio-invoice-card';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const { invoiceId, secrets } = validateWithSchema(GetBillingInvoiceInputSchema, input);
  console.groupEnd();
  console.debug('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  console.group('performEffect');
  const response = await performEffect({
    oystehr,
    stripe: getStripeClient(secrets),
    invoiceId,
  });
  console.groupEnd();
  console.debug('performEffect success');

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export async function performEffect({
  oystehr,
  stripe,
  invoiceId,
}: {
  oystehr: Oystehr;
  stripe: Stripe;
  invoiceId: string;
}): Promise<SetupBillingNioInvoiceCardResponse> {
  const invoice = await fetchById<Invoice>(oystehr, 'Invoice', invoiceId);
  const { stripeAccount, nio } = await resolveInvoiceStripePayer({
    oystehr,
    invoice,
  });
  const customer = await ensureOrganizationStripeCustomerId({
    oystehr,
    stripe,
    organization: nio,
    stripeAccount,
  });
  const setupIntent = await stripe.setupIntents.create(
    {
      customer,
      automatic_payment_methods: {
        enabled: false,
      },
      payment_method_types: ['card'],
    },
    {
      stripeAccount,
    }
  );
  if (!setupIntent.client_secret) throw new Error(`Stripe returned SetupIntent ${setupIntent.id} with no secret`);
  return {
    clientSecret: setupIntent.client_secret,
    stripeAccount,
  };
}
