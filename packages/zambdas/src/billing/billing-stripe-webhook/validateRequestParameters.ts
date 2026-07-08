import Stripe from 'stripe';
import { getSecret, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, Secrets, SecretsKeys } from 'utils';
import { getStripeClient, ZambdaInput } from '../../shared';

export interface BillingStripeWebhookParams {
  event: Stripe.Event;
  secrets: Secrets;
}

// API Gateway keeps the Stripe-Signature casing, the local express server lower-cases it
export function validateRequestParameters(input: ZambdaInput): BillingStripeWebhookParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const signature = input.headers?.['Stripe-Signature'] ?? input.headers?.['stripe-signature'];
  if (!signature) {
    throw new Error('Missing Stripe-Signature header');
  }

  const event = getStripeClient(input.secrets).webhooks.constructEvent(
    input.body,
    signature,
    getSecret(SecretsKeys.STRIPE_WEBHOOK_SECRET, input.secrets)
  );

  return { event, secrets: input.secrets };
}
