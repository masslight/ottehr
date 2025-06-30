import { Identifier } from 'fhir/r4b';
import Stripe from 'stripe';
import { getSecret, Secrets, SecretsKeys } from 'utils';

export interface StripeEnvironmentConfig {
  publicKey: string;
  secretKey: string;
}

export interface StripeEnvironment extends StripeEnvironmentConfig {
  paymentMethodTypes: string;
  apiVersion: string;
}

const validateStripeEnvironment = (secrets: Secrets | null): StripeEnvironment => {
  const secretKey = getSecret(SecretsKeys.STRIPE_SECRET_KEY, secrets);
  const publicKey = getSecret(SecretsKeys.STRIPE_PUBLIC_KEY, secrets);

  if (!secretKey) {
    throw '"STRIPE_SECRET_KEY" environment variable was not set.';
  }
  if (!publicKey) {
    throw '"STRIPE_PUBLIC_KEY" environment variable was not set.';
  }

  return {
    publicKey,
    secretKey,
    paymentMethodTypes: 'card',
    apiVersion: '2024-04-10',
  };
};

export function getStripeClient(secrets: Secrets | null): Stripe {
  const env = validateStripeEnvironment(secrets);
  return new Stripe(env.secretKey, {
    // @ts-expect-error default api version older than sdk
    apiVersion: env.apiVersion,
  });
}

export const STRIPE_PAYMENT_ID_SYSTEM = 'https://fhir.oystehr.com/PaymentIdSystem/stripe';
export const makeBusinessIdentifierForStripePayment = (stripePaymentId: string): Identifier => {
  return {
    system: STRIPE_PAYMENT_ID_SYSTEM,
    value: stripePaymentId,
  };
};
