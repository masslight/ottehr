/* eslint-disable @typescript-eslint/no-unused-vars */
import { ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE, CreditCardInfo, getSecret, Secrets, SecretsKeys } from 'utils';
import Stripe from 'stripe';
import Oystehr from '@oystehr/sdk';
import { Account, Identifier } from 'fhir/r4b';

export interface BasePaymentMgmtInput {
  secrets: Secrets | null;
  token: string;
  beneficiaryPatientId: string;
  payorProfile: string;
  stripeCustomerId?: string;
}
interface DeletePaymentMethodInput extends BasePaymentMgmtInput {
  paymentMethodId: string;
}
export async function deletePaymentMethodRequest(input: DeletePaymentMethodInput): Promise<any> {
  const { secrets, token, beneficiaryPatientId, payorProfile, paymentMethodId } = input;

  console.log(
    'benficiaryPatientId, payorProfile, paymentMethodId',
    beneficiaryPatientId,
    payorProfile,
    paymentMethodId
  );
  const stripeClient = getStripeClient(secrets);
  console.log('stripeClient= ', stripeClient);
}

export async function postPaymentMethodListRequest(input: BasePaymentMgmtInput): Promise<any> {
  const { secrets, token, beneficiaryPatientId, payorProfile } = input;

  console.log('benficiaryPatientId, payorProfile', beneficiaryPatientId, payorProfile);
  const stripeClient = getStripeClient(secrets);
  console.log('stripeClient= ', stripeClient.paymentMethods);
  const pms = await stripeClient.paymentMethods.list();
  console.log('pms= ', pms);
  return pms;
}

interface CreateStripeAccountInput {
  email: string;
  phone: string;
  patientId: string;
}

const createStripeCustomer = async (stripe: Stripe, input: CreateStripeAccountInput): Promise<Stripe.Customer> => {
  const { email, phone, patientId } = input;
  const customer = await stripe.customers.create({
    email,
    phone,
    metadata: {
      oystehr_patient_id: patientId,
    },
  });
  return customer;
};

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
interface PaymentMethodsFromJSON {
  cards: CreditCardInfoFromJSON[];
  default?: CreditCardInfoFromJSON;
}

interface CreditCardInfoFromJSON {
  id: string;
  brand: string;
  expirationMonth: number;
  expirationYear: number;
  lastFour: string;
}

function convert(jsonCard: CreditCardInfoFromJSON, defaultId?: string): CreditCardInfo {
  return {
    id: jsonCard.id,
    brand: jsonCard.brand,
    expMonth: jsonCard.expirationMonth,
    expYear: jsonCard.expirationYear,
    lastFour: jsonCard.lastFour,
    default: jsonCard.id === defaultId,
  };
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
