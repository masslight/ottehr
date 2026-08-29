import Oystehr from '@oystehr/sdk';
import { Account, Identifier, Patient, PaymentNotice, RelatedPerson } from 'fhir/r4b';
import Stripe from 'stripe';
import { getStripeCustomerIdFromAccount } from 'utils/lib/fhir/helpers';
import { getEmailForIndividual, getFullName } from 'utils/lib/fhir/patient';
import { parsePaymentRefundsFromNotice, upsertPaymentRefundsExtension } from 'utils/lib/fhir/paymentRefunds';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { PaymentRefundDTO } from 'utils/lib/types/api/patient-payment-types';
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

export const stripeRefundToDTO = (refund: Stripe.Refund): PaymentRefundDTO => ({
  stripeRefundId: refund.id,
  amountInCents: refund.amount ?? 0,
  dateISO: new Date(refund.created * 1000).toISOString(),
  status: refund.status ?? undefined,
  // refunds issued from the EHR carry the staff-selected reason (and notes) in metadata
  reason: refund.metadata?.reason ?? refund.reason ?? undefined,
  notes: refund.metadata?.notes ?? undefined,
});

// stamps refund state onto the original PaymentNotice so consumers can read it from FHIR without Stripe
export const applyRefundsToPaymentNotice = async (
  oystehr: Oystehr,
  notice: PaymentNotice,
  refunds: PaymentRefundDTO[]
): Promise<void> => {
  if (!notice.id) return;
  const existing = parsePaymentRefundsFromNotice(notice);
  if (refunds.length === 0 && !existing) return;
  const canonical = (list: PaymentRefundDTO[]): string =>
    JSON.stringify([...list].sort((a, b) => a.stripeRefundId.localeCompare(b.stripeRefundId)));
  if (existing && canonical(existing) === canonical(refunds)) return;

  await oystehr.fhir.patch<PaymentNotice>({
    resourceType: 'PaymentNotice',
    id: notice.id,
    operations: [
      {
        op: notice.extension !== undefined ? 'replace' : 'add',
        path: '/extension',
        value: upsertPaymentRefundsExtension(notice.extension, refunds),
      },
    ],
  });
};

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
