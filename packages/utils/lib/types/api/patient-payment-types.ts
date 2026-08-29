export interface PaymentRefundDTO {
  stripeRefundId: string;
  amountInCents: number;
  dateISO: string;
  status?: string;
  reason?: string;
  notes?: string;
}

export const PAYMENT_REFUND_VOID_REASONS = [
  'Entered in error',
  'Service not provided',
  'Duplicate charge',
  'Overcharge',
  'Other',
] as const;
export type PaymentRefundVoidReason = (typeof PAYMENT_REFUND_VOID_REASONS)[number];

export interface RefundPatientPaymentInput {
  encounterId: string;
  paymentNoticeId: string;
  reason: PaymentRefundVoidReason;
  notes?: string;
  amountInCents?: number; // defaults to the full remaining (un-refunded) amount
}

export interface RefundPatientPaymentResponse {
  refundId: string;
  amountInCents: number;
}

export interface VoidPatientPaymentInput {
  encounterId: string;
  paymentNoticeId: string;
  reason: PaymentRefundVoidReason;
  notes?: string;
}

export interface VoidPatientPaymentResponse {
  paymentNoticeId: string;
  voidedBillingNoticeCount: number;
}

export interface CardPaymentDTO {
  paymentMethod: 'card';
  amountInCents: number;
  dateISO: string;
  fhirPaymentNotificationId: string;
  cardBrand?: string;
  cardLast4?: string; // this can be undefined for a brief period while it is being processed, but we have all we need to render the payment in FHIR
  stripePaymentMethodId: string | undefined; // this can be undefined for a brief period while it is being processed, but we have all we need to render the payment in FHIR
  stripePaymentId: string | undefined; // this can be undefined for a brief period while it is being processed, but we have all we need to render the payment in FHIR
  description?: string;
  refundedAmountInCents?: number; // settled (non-failed) refund total
  refunds?: PaymentRefundDTO[];
  voided?: boolean;
  voidReason?: string;
  voidNotes?: string;
}

export interface CashPaymentDTO {
  paymentMethod: 'cash' | 'check' | 'card-reader' | 'external-card-reader'; // terminal fallback external card reader payments are treated like cash/check because we have no direct processor link in this flow
  amountInCents: number;
  dateISO: string;
  fhirPaymentNotificationId?: string;
  cardBrand?: string;
  cardLast4?: string;
  description?: string;
  refundedAmountInCents?: number; // settled (non-failed) refund total
  refunds?: PaymentRefundDTO[];
  voided?: boolean;
  voidReason?: string;
  voidNotes?: string;
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

export interface TerminalReaderDTO {
  id: string;
  label: string | null;
  deviceType: string;
  status: string | null;
  simulated: boolean;
}

export interface GetPatientPaymentTerminalConfigResponse {
  terminalConfigured: boolean;
  terminalLocationId?: string;
  terminalSimulatorMode?: boolean;
  readers: TerminalReaderDTO[];
}

export interface GetPatientPaymentTerminalConfigInput {
  encounterId: string;
}

export interface InitiatePatientPaymentTerminalInput {
  patientId: string;
  encounterId: string;
  amountInCents: number;
  readerId: string;
  simulatedReader?: boolean;
  description?: string;
}

export interface InitiatePatientPaymentTerminalResponse {
  paymentIntentId: string;
  readerId: string;
  readerActionStatus: TerminalPaymentActionStatus;
}

export interface CheckPatientPaymentTerminalStatusInput {
  encounterId: string;
  readerId: string;
}

export type TerminalPaymentActionStatus = 'in_progress' | 'succeeded' | 'failed';

export interface CheckPatientPaymentTerminalStatusResponse {
  actionStatus: TerminalPaymentActionStatus;
  failureCode?: string | null;
  failureMessage?: string | null;
}

export interface CancelTerminalReaderActionInput {
  encounterId: string;
  readerId: string;
}

export interface CancelTerminalReaderActionResponse {
  success: boolean;
}

export interface FinalizePatientPaymentTerminalInput {
  patientId: string;
  encounterId: string;
  paymentIntentId: string;
}

export interface FinalizePatientPaymentTerminalResponse {
  patientId: string;
  encounterId: string;
  paymentIntentId: string;
  paymentNoticeId?: string;
  defaultPaymentMethodId?: string;
}

interface CardPayment {
  paymentMethod: 'card';
  amountInCents: number;
  paymentMethodId: string;
  description?: string;
  // Client-generated key, stable across retries of the same logical payment, that lets the
  // server dedupe replayed requests (e.g. a re-click after a response is lost on a flaky
  // connection) instead of recording a duplicate PaymentNotice.
  idempotencyKey?: string;
}

interface CashPayment {
  paymentMethod: 'cash' | 'check' | 'card-reader' | 'external-card-reader'; // terminal fallback external card reader payments are treated like cash/check because we have no direct processor link in this flow
  amountInCents: number;
  description?: string;
  // See CardPayment.idempotencyKey.
  idempotencyKey?: string;
}

export type CashOrCardPayment = CardPayment | CashPayment;

export interface PostPatientPaymentInput {
  patientId: string;
  encounterId: string;
  paymentDetails: CashOrCardPayment;
}
