import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Invoice } from 'fhir/r4b';
import Stripe from 'stripe';
import { getStripeCustomerIdFromAccount } from 'utils/lib/fhir/helpers';
import { GetBillingInvoiceInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { ListBillingNioInvoicePaymentMethodsResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { getStripeClient } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { resolveInvoiceStripePayer } from '../invoice-stripe';
import { createBillingClient, fetchById } from '../shared';
import { listCustomerCards, STRIPE_CARD_LIST_TIMEOUT_MS } from '../stripe-cards';

let m2mToken: string;
const ZAMBDA_NAME = 'list-billing-nio-invoice-payment-methods';

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
    stripe: getStripeClient(secrets, {
      timeoutMs: STRIPE_CARD_LIST_TIMEOUT_MS,
    }),
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
}): Promise<ListBillingNioInvoicePaymentMethodsResponse> {
  const invoice = await fetchById<Invoice>(oystehr, 'Invoice', invoiceId);
  const { stripeAccount, nio } = await resolveInvoiceStripePayer({
    oystehr,
    invoice,
  });
  const customerId = getStripeCustomerIdFromAccount(nio, stripeAccount);
  return {
    cards: customerId
      ? await listCustomerCards(stripe, {
          customerId,
          stripeAccount,
        })
      : [],
  };
}
