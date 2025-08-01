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
  paymentMethod: 'cash' | 'check';
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
  paymentMethod: 'cash' | 'check';
  amountInCents: number;
  description?: string;
}

export type CashOrCardPayment = CardPayment | CashPayment;

export interface PostPatientPaymentInput {
  patientId: string;
  encounterId: string;
  paymentDetails: CashOrCardPayment;
}
