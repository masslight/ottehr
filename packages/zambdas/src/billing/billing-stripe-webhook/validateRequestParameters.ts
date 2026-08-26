import Stripe from 'stripe';
import { getOptionalSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import {
  INVALID_INPUT_ERROR,
  MISCONFIGURED_ENVIRONMENT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
} from 'utils/lib/types/errors';
import { getStripeClient } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';

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
    throw INVALID_INPUT_ERROR('Missing Stripe-Signature header');
  }

  // Non-production environments may accept both connected-account and platform-account events.
  // Each Stripe destination has its own signing secret, so verify every configured secret.
  const webhookSecrets = new Set(
    [
      getOptionalSecret(SecretsKeys.STRIPE_WEBHOOK_SECRET, input.secrets),
      getOptionalSecret(SecretsKeys.STRIPE_PLATFORM_WEBHOOK_SECRET, input.secrets),
    ].filter((secret): secret is string => !!secret)
  );
  if (webhookSecrets.size === 0) {
    throw MISCONFIGURED_ENVIRONMENT_ERROR(
      'Neither "STRIPE_WEBHOOK_SECRET" nor "STRIPE_PLATFORM_WEBHOOK_SECRET" was set. Please ensure at least one is configured in project secrets.'
    );
  }

  const stripe = getStripeClient(input.secrets);
  for (const webhookSecret of webhookSecrets) {
    try {
      const event = stripe.webhooks.constructEvent(input.body, signature, webhookSecret);
      return { event, secrets: input.secrets };
    } catch {
      // The signature may belong to another configured Stripe destination.
    }
  }

  throw INVALID_INPUT_ERROR('Invalid Stripe webhook signature');
}
