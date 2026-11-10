import { PaymentNotice } from 'fhir/r4b';
import { GetEncounterPaymentNoticeResponse } from 'utils/lib/types/api/encounter-payment-notice.types';
import { vi } from 'vitest';
import { STRIPE_PAYMENT_ID_SYSTEM } from '../../../src/shared/stripeIntegration';

interface EhrPaymentNoticeRequest {
  id: string;
  encounterId: string;
  paymentNoticeId?: string;
  stripePaymentIds?: string[];
  includeStripeAccount?: true;
}

/**
 * Stands in for the EHR's get-encounter-payment-notice zambda, which billing invokes through the
 * billing client's zambda API: serves the clinical notices it is given, scoped to the encounter as
 * the zambda's FHIR search is, and the schedule's Stripe account when asked for it.
 */
export const fakeEhrPaymentNoticeZambda = (
  stripeAccount: string | undefined
): {
  execute: ReturnType<typeof vi.fn>;
  serve: (...notices: PaymentNotice[]) => void;
  noticeRequests: () => EhrPaymentNoticeRequest[];
  stripeAccountRequests: () => EhrPaymentNoticeRequest[];
} => {
  let notices: PaymentNotice[] = [];
  const execute = vi.fn(async (request: EhrPaymentNoticeRequest): Promise<{ output: unknown }> => {
    if (request.id !== 'get-encounter-payment-notice') throw new Error(`Unexpected zambda ${request.id}`);
    const { encounterId, paymentNoticeId, stripePaymentIds, includeStripeAccount } = request;
    const paymentNotice = notices.find(
      (notice) =>
        notice.request?.reference === `Encounter/${encounterId}` &&
        ((paymentNoticeId && notice.id === paymentNoticeId) ||
          notice.identifier?.some(
            (identifier) =>
              identifier.system === STRIPE_PAYMENT_ID_SYSTEM && stripePaymentIds?.includes(identifier.value ?? '')
          ))
    );
    const output: GetEncounterPaymentNoticeResponse = {
      ...(paymentNotice ? { paymentNotice } : {}),
      ...(includeStripeAccount && stripeAccount ? { stripeAccount } : {}),
    };
    return { output };
  });
  const requests = (): EhrPaymentNoticeRequest[] => execute.mock.calls.map(([request]) => request);
  return {
    execute,
    serve: (...served) => {
      notices = served;
    },
    noticeRequests: () => requests().filter((request) => request.paymentNoticeId || request.stripePaymentIds),
    stripeAccountRequests: () => requests().filter((request) => request.includeStripeAccount),
  };
};
