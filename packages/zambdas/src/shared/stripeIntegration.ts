import Oystehr from '@oystehr/sdk';
import { Account, Identifier, Patient, RelatedPerson } from 'fhir/r4b';
import Stripe from 'stripe';
import {
  getEmailForIndividual,
  getFullName,
  getSecret,
  getStripeCustomerIdFromAccount,
  Secrets,
  SecretsKeys,
} from 'utils';
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
}> => {
  const { guarantorResource: guarantor, account, patientId, stripeClient, stripeAccount } = params;
  if (!account.id) {
    throw new Error('Account ID is not defined');
  }

  let customerId = account ? getStripeCustomerIdFromAccount(account, stripeAccount) : undefined;

  let updatedAccount = account;
  if (customerId === undefined) {
    const customer = await stripeClient.customers.create(
      {
        email: guarantor ? getEmailForIndividual(guarantor) : undefined,
        name: guarantor ? getFullName(guarantor) : undefined,
        metadata: {
          oystehr_patient_id: patientId,
        },
      },
      {
        stripeAccount, // Connected account ID if any
      }
    );
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
  return { updatedAccount, customerId };
};
