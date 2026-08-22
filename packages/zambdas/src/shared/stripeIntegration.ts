import Oystehr from '@oystehr/sdk';
import { Account, Identifier, Patient, RelatedPerson } from 'fhir/r4b';
import Stripe from 'stripe';
import { getStripeCustomerIdFromAccount } from 'utils/lib/fhir/helpers';
import { getEmailForIndividual, getFullName } from 'utils/lib/fhir/patient';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { makeStripeCustomerId } from '../patient/payment-methods/helpers';

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

// Spaces out request starts so bulk crawls stay well under Stripe's rate limits
// (100 req/s live mode, 25 req/s test mode). Shared across all throttled clients in a warm container.
const STRIPE_MIN_REQUEST_SPACING_MS = 60; // ~16 req/s
let stripeNextRequestAt = 0;
const throttledStripeFetch: typeof fetch = async (input, init) => {
  const now = Date.now();
  const startAt = Math.max(now, stripeNextRequestAt);
  stripeNextRequestAt = startAt + STRIPE_MIN_REQUEST_SPACING_MS;
  if (startAt > now) await new Promise<void>((resolve) => setTimeout(resolve, startAt - now));
  return fetch(input, init);
};

// For high-request-volume flows (report crawls): throttles request rate and retries transient
// failures (including 429s) at the SDK level.
export function getRateLimitedStripeClient(secrets: Secrets | null): Stripe {
  const env = validateStripeEnvironment(secrets);
  return new Stripe(env.secretKey, {
    // @ts-expect-error default api version older than sdk
    apiVersion: env.apiVersion,
    maxNetworkRetries: 2,
    httpClient: Stripe.createFetchHttpClient(throttledStripeFetch),
  });
}

export const STRIPE_PAYMENT_ID_SYSTEM = 'https://fhir.oystehr.com/PaymentIdSystem/stripe';
export const makeBusinessIdentifierForStripePayment = (stripePaymentId: string): Identifier => {
  return {
    system: STRIPE_PAYMENT_ID_SYSTEM,
    value: stripePaymentId,
  };
};

export const STRIPE_METADATA_KEYS = {
  patientId: 'oystehr_patient_id',
  encounterId: 'oystehr_encounter_id',
  legacyEncounterId: 'encounterId',
} as const;

export const encounterIdFromStripeMetadata = (metadata: Stripe.Metadata | null | undefined): string | undefined =>
  metadata?.[STRIPE_METADATA_KEYS.encounterId] || metadata?.[STRIPE_METADATA_KEYS.legacyEncounterId] || undefined;

export const patientIdFromStripeMetadata = (metadata: Stripe.Metadata | null | undefined): string | undefined =>
  metadata?.[STRIPE_METADATA_KEYS.patientId] || undefined;

export const stripeEncounterMetadata = (params: { encounterId: string; patientId: string }): Stripe.MetadataParam => ({
  [STRIPE_METADATA_KEYS.patientId]: params.patientId,
  [STRIPE_METADATA_KEYS.encounterId]: params.encounterId,
});

export const stripeEncounterMetadataQuery = (encounterId: string): string =>
  `metadata['${STRIPE_METADATA_KEYS.legacyEncounterId}']:"${encounterId}" OR ` +
  `metadata['${STRIPE_METADATA_KEYS.encounterId}']:"${encounterId}"`;

interface EnsureStripeCustomerIdParams {
  guarantorResource: Patient | RelatedPerson | undefined;
  account: Account;
  patientId: string;
  stripeClient: Stripe;
  stripeAccount?: string;
}

export const ensureStripeCustomerId = async (
  params: EnsureStripeCustomerIdParams,
  oystehrClient: Oystehr
): Promise<{
  updatedAccount: Account;
  customerId: string;
  createdWithoutEmail: boolean;
}> => {
  const { guarantorResource: guarantor, account, patientId, stripeClient, stripeAccount } = params;
  if (!account.id) {
    throw new Error('Account ID is not defined');
  }

  let customerId = account ? getStripeCustomerIdFromAccount(account, stripeAccount) : undefined;

  let updatedAccount = account;
  let createdWithoutEmail = false;
  if (customerId === undefined) {
    const email = guarantor ? getEmailForIndividual(guarantor) : undefined;
    createdWithoutEmail = !email;
    const name = guarantor ? getFullName(guarantor) : undefined;
    let customer: Stripe.Customer;
    try {
      customer = await stripeClient.customers.create(
        {
          email,
          name,
          metadata: {
            [STRIPE_METADATA_KEYS.patientId]: patientId,
          },
        },
        { stripeAccount }
      );
    } catch (stripeError: any) {
      if (stripeError?.type === 'StripeInvalidRequestError' && stripeError?.param === 'email') {
        console.warn(`Stripe rejected email for patient ${patientId}, creating customer without email`);
        customer = await stripeClient.customers.create(
          {
            name,
            metadata: {
              [STRIPE_METADATA_KEYS.patientId]: patientId,
            },
          },
          { stripeAccount }
        );
        createdWithoutEmail = true;
      } else {
        throw stripeError;
      }
    }
    const op = 'add';
    let value: Identifier | Identifier[] = makeStripeCustomerId(customer.id, stripeAccount);
    let path = '/identifier/-';
    if (account.identifier === undefined) {
      value = [value];
      path = '/identifier';
    }
    updatedAccount = await oystehrClient.fhir.patch<Account>({
      id: account.id,
      resourceType: 'Account',
      operations: [
        {
          op,
          path,
          value,
        },
      ],
    });
    customerId = customer.id;
  }
  return { updatedAccount, customerId, createdWithoutEmail };
};
