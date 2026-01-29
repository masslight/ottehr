import { Stripe } from 'stripe';
interface PaymentMethodPatientParameters {
  beneficiaryPatientId: string;
  appointmentId: string;
}

interface PaymentMethodParameters {
  paymentMethodId: string;
}

export type PaymentMethodSetupParameters = PaymentMethodPatientParameters;
export type PaymentMethodSetDefaultParameters = PaymentMethodPatientParameters & PaymentMethodParameters;
export type PaymentMethodListParameters = PaymentMethodPatientParameters;
export type PaymentMethodDeleteParameters = PaymentMethodPatientParameters & PaymentMethodParameters;

export interface CreditCardInfo {
  id: Stripe.PaymentMethod['id'];
  brand: Stripe.Card['brand'];
  expMonth: Stripe.Card['exp_month'];
  expYear: Stripe.Card['exp_year'];
  lastFour: Stripe.Card['last4'];
  default?: boolean;
}
export interface ListPaymentMethodsZambdaOutput {
  cards: CreditCardInfo[];
}

export interface PaymentMethodSetupZambdaOutput {
  clientSecret: string;
  stripeAccount: string | undefined;
}

export interface GetPatientBalancesInput {
  patientId: string;
}

export interface GetPatientBalancesOutput {
  totalBalanceCents: number;
  encounters: {
    encounterId: string;
    patientBalanceCents: number;
  }[];
}
