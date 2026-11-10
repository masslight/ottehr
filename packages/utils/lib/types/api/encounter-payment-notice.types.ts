import { PaymentNotice } from 'fhir/r4b';
import { z } from 'zod';

// Stripe payment ids one lookup may match on; a payment carries its intent and charge ids
export const MAX_ENCOUNTER_PAYMENT_NOTICE_STRIPE_IDS = 20;

/**
 * Input of the EHR's get-encounter-payment-notice zambda: the clinical PaymentNotice an encounter's
 * payment was recorded on, looked up by its id or by the Stripe payments it records, and optionally
 * the Stripe account the encounter's schedule owner takes payments on.
 */
export const GetEncounterPaymentNoticeInputSchema = z
  .object({
    encounterId: z.string().trim().uuid(),
    paymentNoticeId: z.string().trim().uuid().optional(),
    stripePaymentIds: z.array(z.string().trim().min(1)).min(1).max(MAX_ENCOUNTER_PAYMENT_NOTICE_STRIPE_IDS).optional(),
    includeStripeAccount: z.literal(true).optional(),
  })
  .refine((input) => !(input.paymentNoticeId && input.stripePaymentIds), {
    message: 'Look a payment notice up by "paymentNoticeId" or by "stripePaymentIds", not both.',
  })
  .refine((input) => input.paymentNoticeId || input.stripePaymentIds || input.includeStripeAccount, {
    message: 'Provide "paymentNoticeId", "stripePaymentIds" or "includeStripeAccount".',
  });

export type GetEncounterPaymentNoticeInput = z.output<typeof GetEncounterPaymentNoticeInputSchema>;

export interface GetEncounterPaymentNoticeResponse {
  // absent when no clinical notice of the encounter matches the lookup, or none was asked for
  paymentNotice?: PaymentNotice;
  // set only when includeStripeAccount was asked for; absent when the schedule owner has no account
  stripeAccount?: string;
}
