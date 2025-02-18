import Oystehr from '@oystehr/sdk';
import { CreditCardInfo } from 'utils';
import { createOystehrClient } from '../shared/helpers';
import { Secrets } from 'zambda-utils';

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
  const stripeConfig = await selectStripeConfig(oystehrClient);
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

const selectStripeConfig = async (oystehrClient: Oystehr): Promise<any> => {
  const settings = await oystehrClient.project.get();
  console.log('THE PROJECT SETTINGS', JSON.stringify(settings, null, 2));
  const isSandbox = settings.sandbox;

  if (isSandbox) {
    return 'Stripe config for sandbox';
  }

  return 'Stripe config for production';
};

export interface StripeEnvironmentConfig {
  publishableKey: string;
  secretKey: string;
}

export interface StripeEnvironment {
  live: StripeEnvironmentConfig;
  test: StripeEnvironmentConfig;
  paymentMethodTypes: string;
}

export interface StripeWebhookEnvironment extends StripeEnvironmentConfig {
  webhookSecret: string;
  paymentMethodTypes: string;
}

export const validateStripeWebhookEnvironment = (): StripeWebhookEnvironment => {
  const stripeSecretKey = process.env.stripeSecretKey;
  const stripePublishableKey = process.env.stripePublishableKey;
  const stripeWebhookSecret = process.env.stripeWebhookSecret;
  const stripePaymentMethodTypes = process.env.stripePaymentMethodTypes;

  if (!stripeSecretKey) {
    throw '"stripeSecretKey" environment variable was not set.';
  }
  if (!stripePublishableKey) {
    throw '"stripePublishableKey" environment variable was not set.';
  }
  if (!stripeWebhookSecret) {
    throw '"stripeWebhookSecret" environment variable was not set.';
  }
  if (!stripePaymentMethodTypes) {
    throw '"stripePaymentMethodTypes" environment variable was not set.';
  }

  return {
    publishableKey: stripePublishableKey,
    secretKey: stripeSecretKey,
    webhookSecret: stripeWebhookSecret,
    paymentMethodTypes: stripePaymentMethodTypes,
  };
};

export const validateStripeEnvironment = (): StripeEnvironment => {
  const liveModeStripeSecretKey = process.env.liveModeStripeSecretKey;
  const liveModeStripePublishableKey = process.env.liveModeStripePublishableKey;
  const testModeStripeSecretKey = process.env.testModeStripeSecretKey;
  const testModeStripePublishableKey = process.env.testModeStripePublishableKey;
  const stripePaymentMethodTypes = process.env.stripePaymentMethodTypes;

  if (!liveModeStripeSecretKey) {
    throw '"liveModeStripeSecretKey" environment variable was not set.';
  }
  if (!liveModeStripePublishableKey) {
    throw '"liveModeStripePublishableKey" environment variable was not set.';
  }
  if (!testModeStripeSecretKey) {
    throw '"testModeStripeSecretKey" environment variable was not set.';
  }
  if (!testModeStripePublishableKey) {
    throw '"testModeStripePublishableKey" environment variable was not set.';
  }
  if (!stripePaymentMethodTypes) {
    throw '"stripePaymentMethodTypes" environment variable was not set.';
  }

  return {
    live: {
      publishableKey: liveModeStripePublishableKey,
      secretKey: liveModeStripeSecretKey,
    },
    test: {
      publishableKey: testModeStripePublishableKey,
      secretKey: testModeStripeSecretKey,
    },
    paymentMethodTypes: stripePaymentMethodTypes,
  };
};
