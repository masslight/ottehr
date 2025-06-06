export interface CardPaymentDTO {
  paymentMethod: 'card';
  amountInCents: number;
  dateISO: string;
  cardLast4: string;
  stripePaymentId: string;
  stripePaymentMethodId: string;
  fhirPaymentNotificationId?: string;
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
