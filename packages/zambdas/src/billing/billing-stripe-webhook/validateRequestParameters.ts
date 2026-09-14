import Stripe from 'stripe';
import { getOptionalSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { StripeWebhookSigningSecretsSchema } from 'utils/lib/types/data/billing/stripe-webhook.schemas';
import {
  INVALID_INPUT_ERROR,
  MISCONFIGURED_ENVIRONMENT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
} from 'utils/lib/types/errors';
import { z } from 'zod';
import { getStripeClient } from '../../shared/stripeIntegration';
import { ZambdaInput } from '../../shared/types/common';

export interface BillingStripeWebhookParams {
  event: Stripe.Event;
  stripeAccount?: string;
  secrets: Secrets;
}

const parseSigningSecrets = (value: string | undefined): z.infer<typeof StripeWebhookSigningSecretsSchema> => {
  const raw = value?.trim();
  if (!raw) return [];
  if (!raw.startsWith('[')) return [{ signingSecret: raw }];

  try {
    return StripeWebhookSigningSecretsSchema.parse(JSON.parse(raw));
  } catch {
    throw MISCONFIGURED_ENVIRONMENT_ERROR(
      'Stripe webhook secrets must be a JSON array of entries with signingSecret and optional accountId and name.'
    );
  }
};

// API Gateway keeps the Stripe-Signature casing, the local express server lower-cases it
export function validateRequestParameters(input: ZambdaInput): BillingStripeWebhookParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const signature = input.headers?.['Stripe-Signature'] ?? input.headers?.['stripe-signature'];
  if (!signature) {
    throw INVALID_INPUT_ERROR('Missing Stripe-Signature header');
  }

  const signingSecrets = [
    getOptionalSecret(SecretsKeys.STRIPE_WEBHOOK_SECRET, input.secrets),
    getOptionalSecret(SecretsKeys.STRIPE_PLATFORM_WEBHOOK_SECRET, input.secrets),
  ].flatMap(parseSigningSecrets);
  if (signingSecrets.length === 0) {
    throw MISCONFIGURED_ENVIRONMENT_ERROR(
      'Neither "STRIPE_WEBHOOK_SECRET" nor "STRIPE_PLATFORM_WEBHOOK_SECRET" was set. Please ensure at least one is configured in project secrets.'
    );
  }

  const accountsBySecret = new Map<string, string | undefined>();
  for (const { signingSecret, accountId } of signingSecrets) {
    if (accountsBySecret.has(signingSecret) && accountsBySecret.get(signingSecret) !== accountId) {
      throw MISCONFIGURED_ENVIRONMENT_ERROR('A Stripe webhook signing secret is mapped to different accounts.');
    }
    accountsBySecret.set(signingSecret, accountId);
  }

  const stripe = getStripeClient(input.secrets);
  for (const [signingSecret, accountId] of accountsBySecret) {
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(input.body, signature, signingSecret);
    } catch {
      // The signature may belong to another configured Stripe destination
      continue;
    }
    if (accountId && event.account !== undefined && accountId !== event.account) {
      throw INVALID_INPUT_ERROR('Stripe webhook account does not match the configured account.');
    }
    return { event, stripeAccount: event.account ?? accountId, secrets: input.secrets };
  }

  throw INVALID_INPUT_ERROR('Invalid Stripe webhook signature');
}
