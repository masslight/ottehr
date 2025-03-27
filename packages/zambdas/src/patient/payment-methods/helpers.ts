/* eslint-disable @typescript-eslint/no-unused-vars */
import { CreditCardInfo, getSecret, Secrets, SecretsKeys } from 'utils';
import Stripe from 'stripe';
import Oystehr from '@oystehr/sdk';
import { Account } from 'fhir/r4b';

export interface BasePaymentMgmtInput {
  secrets: Secrets | null;
  token: string;
  beneficiaryPatientId: string;
  payorProfile: string;
  stripeCustomerId?: string;
}
export async function postPaymentMethodSetupRequest(input: BasePaymentMgmtInput): Promise<any> {
  const { secrets, token, beneficiaryPatientId, payorProfile } = input;

  console.log('setting up payment method', beneficiaryPatientId, payorProfile);

  const stripeClient = getStripeClient(secrets);
  console.log('stripeClient= ', stripeClient);

  return {};
}

interface PostPaymentMethodInput extends BasePaymentMgmtInput {
  paymentMethodId: string;
}

export async function postPaymentMethodSetDefaultRequest(input: PostPaymentMethodInput): Promise<any> {
  // const serviceUrl = `${apiUrl}/payment/payment-method/set-default`;
  const { secrets, token, beneficiaryPatientId, payorProfile, paymentMethodId } = input;
  const stripeClient = getStripeClient(secrets);
  console.log('stripeClient= ', stripeClient);
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
  console.log('stripeClient= ', stripeClient);
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

const getBillingAccountForPatient = async (patientId: string, oystehrClient: Oystehr): Promise<Account | undefined> => {
  const accounts = await oystehrClient.fhir.search<Account>({
    resourceType: 'Account',
    params: [
      {
        name: 'patient',
        value: `Patient/${patientId}`,
      },
      {
        name: 'identifier',
        value: 'TODO: tbd',
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

interface ListOutput {
  default?: PaymentCard;
  cards: PaymentCard[];
}

interface PaymentMethods {
  cards: CreditCardInfo[];
  default?: CreditCardInfo;
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

function getStripeClient(secrets: Secrets | null): Stripe {
  const env = validateStripeEnvironment(secrets);
  return new Stripe(env.secretKey, {
    // @ts-expect-error default api version older than sdk
    apiVersion: env.apiVersion,
  });
}
