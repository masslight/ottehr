import Oystehr from '@oystehr/sdk';
import { CreditCardInfo } from 'utils';
import { createOystehrClient } from '../shared/helpers';
import { getSecret, Secrets, SecretsKeys } from 'zambda-utils';

export interface BasePaymentMgmtInput {
  secrets: Secrets | null;
  token: string;
  beneficiaryPatientId: string;
  payorProfile: string;
}
export async function postPaymentMethodSetupRequest(input: BasePaymentMgmtInput): Promise<any> {
  const { secrets, token, beneficiaryPatientId, payorProfile } = input;

  console.log('setting up payment method', beneficiaryPatientId, payorProfile);

  const oystehrClient = createOystehrClient(token, secrets);
  const stripeConfig = await selectStripeConfig(oystehrClient, secrets);
  console.log('stripeConfig= ', stripeConfig);
  /*
  const serviceUrl = `${apiUrl}/payment/payment-method/setup`;
  const payorPatientId = payorProfile.replace('Patient/', '');

  console.debug(
    `Posting to payment setup service at ${serviceUrl} for beneficiary patient ${beneficiaryPatientId} and payor ${payorPatientId}`
  );

  return fetch(serviceUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: 'POST',
    body: JSON.stringify({ beneficiaryPatientId: beneficiaryPatientId, payorPatientId: payorPatientId }),
  }).then((response) => {
    if (!response.ok) {
      console.log(`Error setting up payment method. Status: ${response.statusText}`);
      throw new Error(response.statusText);
    }
    return response.json();
  });
  */
  return {};
}

export async function postPaymentMethodSetDefaultRequest(
  apiUrl: string,
  token: string,
  beneficiaryPatientId: string,
  payorProfile: string,
  paymentMethodId: string
): Promise<any> {
  const serviceUrl = `${apiUrl}/payment/payment-method/set-default`;
  const payorPatientId = payorProfile.replace('Patient/', '');

  console.debug(
    `Posting to payment set-default service at ${serviceUrl} for beneficiary patient ${beneficiaryPatientId} and payor ${payorPatientId}`
  );

  return fetch(serviceUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: 'POST',
    body: JSON.stringify({
      beneficiaryPatientId: beneficiaryPatientId,
      payorPatientId: payorPatientId,
      paymentMethodId: paymentMethodId,
    }),
  }).then((response) => {
    if (!response.ok) {
      console.log(`Error setting a default payment method. Status: ${response.statusText}`);
      throw new Error(response.statusText);
    }
  });
}

export async function deletePaymentMethodRequest(
  apiUrl: string,
  token: string,
  beneficiaryPatientId: string,
  payorProfile: string,
  paymentMethodId: string
): Promise<any> {
  const serviceUrl = `${apiUrl}/payment/payment-method`;
  const payorPatientId = payorProfile.replace('Patient/', '');

  console.debug(
    `Posting to payment delete service at ${serviceUrl} for beneficiary patient ${beneficiaryPatientId} and payor ${payorPatientId}`
  );

  return fetch(serviceUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: 'DELETE',
    body: JSON.stringify({
      beneficiaryPatientId: beneficiaryPatientId,
      payorPatientId: payorPatientId,
      paymentMethodId: paymentMethodId,
    }),
  }).then((response) => {
    if (!response.ok) {
      console.log(`Error deleting payment method ${paymentMethodId}. Status: ${response.statusText}`);
      throw new Error(response.statusText);
    }
  });
}

export async function postPaymentMethodListRequest(
  apiUrl: string,
  token: string,
  beneficiaryPatientId: string,
  payorProfile: string
): Promise<any> {
  const serviceUrl = `${apiUrl}/payment/payment-method/list`;
  const payorPatientId = payorProfile.replace('Patient/', '');

  console.debug(
    `Posting to payment method list service at ${serviceUrl} for beneficiary patient ${beneficiaryPatientId} and payor ${payorPatientId}`
  );

  return fetch(serviceUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: 'POST',
    body: JSON.stringify({ beneficiaryPatientId: beneficiaryPatientId, payorPatientId: payorPatientId }),
  })
    .then((response) => {
      if (!response.ok) {
        console.log(`Error listing payment methods for payor ${payorPatientId}. Status: ${response.statusText}`);
        throw new Error(response.statusText);
      }
      return response.json();
    })
    .then((json) => {
      const data: PaymentMethodsFromJSON = json as PaymentMethodsFromJSON;
      const paymentMethods: PaymentMethods = {
        cards: [],
      };

      let defaultId: string;
      if (data.default !== undefined) {
        defaultId = data.default.id;
        paymentMethods.default = convert(data.default, defaultId);
      }
      paymentMethods.cards.push(...data.cards.map((jsonCard) => convert(jsonCard, defaultId)));

      return paymentMethods;
    });
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

const selectStripeConfig = async (oystehrClient: Oystehr, secrets: Secrets | null): Promise<StripeEnvironment> => {
  const settings = await oystehrClient.project.get();
  console.log('THE PROJECT SETTINGS', JSON.stringify(settings, null, 2));
  const isSandbox = settings.sandbox;
  return validateStripeEnvironment(secrets, isSandbox);
};

export interface StripeEnvironmentConfig {
  publishableKey: string;
  secretKey: string;
}

export interface StripeEnvironment extends StripeEnvironmentConfig {
  paymentMethodTypes: string;
}

const validateStripeEnvironment = (secrets: Secrets | null, isSandbox: boolean): StripeEnvironment => {
  const liveModeStripeSecretKey = getSecret(SecretsKeys.STRIPE_SECRET_KEY_LIVE_MODE, secrets);
  const liveModeStripePublishableKey = getSecret(SecretsKeys.STRIPE_PUBLISHABLE_KEY_LIVE_MODE, secrets);
  const testModeStripeSecretKey = getSecret(SecretsKeys.STRIPE_SECRET_KEY_TEST_MODE, secrets);
  const testModeStripePublishableKey = getSecret(SecretsKeys.STRIPE_PUBLISHABLE_KEY_TEST_MODE, secrets);
  const stripePaymentMethodTypes = getSecret(SecretsKeys.STRIPE_PAYMENT_METHOD_TYPES, secrets);

  if (!stripePaymentMethodTypes) {
    throw '"STRIPE_PAYMENT_METHOD_TYPES" environment variable was not set.';
  }
  if (isSandbox) {
    if (!testModeStripeSecretKey) {
      throw '"STRIPE_SECRET_KEY_TEST_MODE" environment variable was not set.';
    }
    if (!testModeStripePublishableKey) {
      throw '"STRIPE_PUBLISHABLE_KEY_TEST_MODE" environment variable was not set.';
    }
    return {
      publishableKey: SecretsKeys.STRIPE_PUBLISHABLE_KEY_TEST_MODE,
      secretKey: SecretsKeys.STRIPE_SECRET_KEY_TEST_MODE,
      paymentMethodTypes: SecretsKeys.STRIPE_PAYMENT_METHOD_TYPES,
    };
  }

  if (!liveModeStripeSecretKey) {
    throw '"STRIPE_SECRET_KEY_LIVE_MODE" environment variable was not set.';
  }
  if (!liveModeStripePublishableKey) {
    throw '"STRIPE_PUBLISHABLE_KEY_LIVE_MODE" environment variable was not set.';
  }

  return {
    publishableKey: SecretsKeys.STRIPE_PUBLISHABLE_KEY_LIVE_MODE,
    secretKey: SecretsKeys.STRIPE_SECRET_KEY_LIVE_MODE,
    paymentMethodTypes: SecretsKeys.STRIPE_PAYMENT_METHOD_TYPES,
  };
};
