export interface CardPaymentDTO {
  paymentMethod: 'card';
  amountInCents: number;
  dateISO: string;
  fhirPaymentNotificationId: string;
  cardLast4?: string; // this can be undefined for a brief period while it is being processed, but we have all we need to render the payment in FHIR
  stripePaymentMethodId: string | undefined; // this can be undefined for a brief period while it is being processed, but we have all we need to render the payment in FHIR
  stripePaymentId: string | undefined; // this can be undefined for a brief period while it is being processed, but we have all we need to render the payment in FHIR
  description?: string;
}

export interface CashPaymentDTO {
  paymentMethod: 'cash' | 'check' | 'card-reader'; // a card reader payment is treated like cash/check because we have no link to the payment beyond what the user submits
  amountInCents: number;
  dateISO: string;
  fhirPaymentNotificationId?: string;
  description?: string;
}

export type PatientPaymentDTO = CardPaymentDTO | CashPaymentDTO;

export interface ListPatientPaymentInput {
  patientId: string;
  encounterId?: string;
}

export interface ListPatientPaymentResponse {
  patientId: string;
  payments: PatientPaymentDTO[];
  encounterId?: string;
}

interface CardPayment {
  paymentMethod: 'card';
  amountInCents: number;
  paymentMethodId: string;
  description?: string;
}

interface CashPayment {
  paymentMethod: 'cash' | 'check' | 'card-reader'; // a card reader payment is treated like cash/check because we have no link to the payment beyond what the user submits
  amountInCents: number;
  description?: string;
}

export type CashOrCardPayment = CardPayment | CashPayment;

export interface PostPatientPaymentInput {
  patientId: string;
  encounterId: string;
  paymentDetails: CashOrCardPayment;
}
