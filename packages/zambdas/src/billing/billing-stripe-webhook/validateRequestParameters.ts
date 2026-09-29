import { SecretsKeys } from 'utils/lib/secrets';
import { StripeWebhookParams, validateStripeWebhook } from '../../shared/stripeWebhook';
import { ZambdaInput } from '../../shared/types/common';

export function validateRequestParameters(input: ZambdaInput): StripeWebhookParams {
  return validateStripeWebhook(
    input,
    [SecretsKeys.STRIPE_WEBHOOK_SECRET, SecretsKeys.STRIPE_PLATFORM_WEBHOOK_SECRET],
    'Neither "STRIPE_WEBHOOK_SECRET" nor "STRIPE_PLATFORM_WEBHOOK_SECRET" was set. Please ensure at least one is configured in project secrets.'
  );
}
