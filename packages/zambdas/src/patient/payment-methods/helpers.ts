import Oystehr, { User } from '@oystehr/sdk';
import { Account, Identifier } from 'fhir/r4b';
import Stripe from 'stripe';
import {
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
  FHIR_RESOURCE_NOT_FOUND,
  getSecret,
  getStripeCustomerIdFromAccount,
  NOT_AUTHORIZED,
  Secrets,
  SecretsKeys,
  STRIPE_CUSTOMER_ID_NOT_FOUND_ERROR,
} from 'utils';
import { getUser, userHasAccessToPatient, ZambdaInput } from '../../shared';

export interface BasePaymentMgmtInput {
  secrets: Secrets | null;
  token: string;
  beneficiaryPatientId: string;
  payorProfile: string;
  stripeCustomerId?: string;
}

export const getBillingAccountForPatient = async (
  patientId: string,
  oystehrClient: Oystehr
): Promise<Account | undefined> => {
  const accounts = await oystehrClient.fhir.search<Account>({
    resourceType: 'Account',
    params: [
      {
        name: 'patient',
        value: `Patient/${patientId}`,
      },
      {
        name: 'status',
        value: 'active',
      },
      {
        name: 'type',
        value: 'PBILLACCT',
      },
    ],
  });
  return accounts.unbundle()[0];
};

export interface PaymentCard {
  id: string;
  brand: string;
  expirationMonth: number;
  expirationYear: number;
  lastFour: string;
  cardholder?: string;
}
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

export const makeStripeCustomerId = (stripeId: string): Identifier => {
  return {
    system: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
    value: stripeId,
  };
};

interface StripeAccountValidationInput {
  patientId: string;
  oystehrClient: Oystehr;
}
export async function getStripeCustomerId(input: StripeAccountValidationInput): Promise<{ stripeCustomerId: string }> {
  const { patientId, oystehrClient } = input;

  const patientAccount = await getBillingAccountForPatient(patientId, oystehrClient);
  if (!patientAccount) {
    throw FHIR_RESOURCE_NOT_FOUND('Account');
  }
  const stripeCustomerId = getStripeCustomerIdFromAccount(patientAccount);
  if (!stripeCustomerId) {
    throw STRIPE_CUSTOMER_ID_NOT_FOUND_ERROR;
  }
  return { stripeCustomerId };
}

interface PatientAccountCheckInput {
  beneficiaryPatientId: string;
  secrets: Secrets | null;
  zambdaInput: ZambdaInput;
}
export const validateUserHasAccessToPatientAccount = async (
  input: PatientAccountCheckInput,
  oystehrClient: Oystehr
): Promise<User> => {
  const { beneficiaryPatientId, secrets, zambdaInput } = input;
  const authorization = zambdaInput.headers.Authorization;
  if (!authorization) {
    console.log('authorization header not found');
    throw NOT_AUTHORIZED;
  }
  const user = await getUser(authorization.replace('Bearer ', ''), secrets);
  const userAccess = await userHasAccessToPatient(user, beneficiaryPatientId, oystehrClient);
  if (!userAccess) {
    console.log('no user access to patient');
    throw NOT_AUTHORIZED;
  }
  return user;
};
