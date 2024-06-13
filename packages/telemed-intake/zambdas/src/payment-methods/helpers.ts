import { CreditCardInfo } from 'ottehr-utils';

export async function postPaymentMethodSetupRequest(
  apiUrl: string,
  token: string,
  beneficiaryPatientId: string,
  payorProfile: string,
): Promise<any> {
  const serviceUrl = `${apiUrl}/payment/payment-method/setup`;
  const payorPatientId = payorProfile.replace('Patient/', '');

  console.debug(
    `Posting to payment setup service at ${serviceUrl} for beneficiary patient ${beneficiaryPatientId} and payor ${payorPatientId}`,
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
}

export async function postPaymentMethodSetDefaultRequest(
  apiUrl: string,
  token: string,
  beneficiaryPatientId: string,
  payorProfile: string,
  paymentMethodId: string,
): Promise<any> {
  const serviceUrl = `${apiUrl}/payment/payment-method/set-default`;
  const payorPatientId = payorProfile.replace('Patient/', '');

  console.debug(
    `Posting to payment set-default service at ${serviceUrl} for beneficiary patient ${beneficiaryPatientId} and payor ${payorPatientId}`,
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
    return response.json();
  });
}

export async function deletePaymentMethodRequest(
  apiUrl: string,
  token: string,
  beneficiaryPatientId: string,
  payorProfile: string,
  paymentMethodId: string,
): Promise<any> {
  const serviceUrl = `${apiUrl}/payment/payment-method`;
  const payorPatientId = payorProfile.replace('Patient/', '');

  console.debug(
    `Posting to payment delete service at ${serviceUrl} for beneficiary patient ${beneficiaryPatientId} and payor ${payorPatientId}`,
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
    return response.json();
  });
}

export async function postPaymentMethodListRequest(
  apiUrl: string,
  token: string,
  beneficiaryPatientId: string,
  payorProfile: string,
): Promise<any> {
  const serviceUrl = `${apiUrl}/payment/payment-method/list`;
  const payorPatientId = payorProfile.replace('Patient/', '');

  console.debug(
    `Posting to payment method list service at ${serviceUrl} for beneficiary patient ${beneficiaryPatientId} and payor ${payorPatientId}`,
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
  exp_month: number;
  exp_year: number;
  last_four: string;
}

function convert(jsonCard: CreditCardInfoFromJSON, defaultId?: string): CreditCardInfo {
  return {
    id: jsonCard.id,
    brand: jsonCard.brand,
    expMonth: jsonCard.exp_month,
    expYear: jsonCard.exp_year,
    lastFour: jsonCard.last_four,
    default: jsonCard.id === defaultId,
  };
}
