interface PaymentMethodPatientParameters {
  beneficiaryPatientId: string;
}

interface PaymentMethodParameters {
  paymentMethodId: string;
}

export type PaymentMethodSetupParameters = PaymentMethodPatientParameters;
export type PaymentMethodSetDefaultParameters = PaymentMethodPatientParameters & PaymentMethodParameters;
export type PaymentMethodListParameters = PaymentMethodPatientParameters;
export type PaymentMethodDeleteParameters = PaymentMethodPatientParameters & PaymentMethodParameters;

/*
 * Example Credit Card Info Object
 *      {
            "id": "pm_1P43vpEDUw09rSJN9kLlHVR0",
            "brand": "amex",
            "expMonth": 11,
            "expYear": 2033,
            "lastFour": "0005"
            "default": true,
        },  
 */
export interface CreditCardInfo {
  id: string;
  brand: string;
  expMonth: number;
  expYear: number;
  lastFour: string;
  default: boolean;
}
