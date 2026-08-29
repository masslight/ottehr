import { Extension, PaymentNotice } from 'fhir/r4b';
import { PaymentRefundDTO } from '../types/api/patient-payment-types';
import { PAYMENT_REFUNDS_EXTENSION_URL, PAYMENT_VOID_EXTENSION_URL } from './constants';

export const buildPaymentRefundsExtension = (refunds: PaymentRefundDTO[]): Extension => ({
  url: PAYMENT_REFUNDS_EXTENSION_URL,
  extension: refunds.map((refund) => ({
    url: 'refund',
    extension: [
      { url: 'refundId', valueString: refund.stripeRefundId },
      { url: 'amountInCents', valueInteger: refund.amountInCents },
      { url: 'created', valueDateTime: refund.dateISO },
      ...(refund.status ? [{ url: 'status', valueString: refund.status }] : []),
      ...(refund.reason ? [{ url: 'reason', valueString: refund.reason }] : []),
      ...(refund.notes ? [{ url: 'notes', valueString: refund.notes }] : []),
    ],
  })),
});

export const parsePaymentRefundsFromNotice = (notice: PaymentNotice): PaymentRefundDTO[] | undefined => {
  const refundsExtension = notice.extension?.find((ext) => ext.url === PAYMENT_REFUNDS_EXTENSION_URL);
  if (!refundsExtension?.extension) return undefined;

  const refunds: PaymentRefundDTO[] = [];
  for (const entry of refundsExtension.extension) {
    if (entry.url !== 'refund' || !entry.extension) continue;
    const field = (url: string): Extension | undefined => entry.extension?.find((ext) => ext.url === url);
    const stripeRefundId = field('refundId')?.valueString;
    const amountInCents = field('amountInCents')?.valueInteger;
    const dateISO = field('created')?.valueDateTime;
    if (!stripeRefundId || amountInCents === undefined || !dateISO) continue;
    refunds.push({
      stripeRefundId,
      amountInCents,
      dateISO,
      status: field('status')?.valueString,
      reason: field('reason')?.valueString,
      notes: field('notes')?.valueString,
    });
  }
  return refunds;
};

// failed/canceled refunds never settle, so they don't reduce what the patient paid
export const settledRefundTotalInCents = (refunds: PaymentRefundDTO[] | undefined): number =>
  (refunds ?? [])
    .filter((refund) => refund.status !== 'failed' && refund.status !== 'canceled')
    .reduce((sum, refund) => sum + refund.amountInCents, 0);

export const upsertPaymentRefundsExtension = (
  extensions: Extension[] | undefined,
  refunds: PaymentRefundDTO[]
): Extension[] => [
  ...(extensions ?? []).filter((ext) => ext.url !== PAYMENT_REFUNDS_EXTENSION_URL),
  buildPaymentRefundsExtension(refunds),
];

export interface PaymentVoidInfo {
  reason: string;
  notes?: string;
  voidedAtISO: string;
}

export const buildPaymentVoidExtension = (info: PaymentVoidInfo): Extension => ({
  url: PAYMENT_VOID_EXTENSION_URL,
  extension: [
    { url: 'reason', valueString: info.reason },
    { url: 'voidedAt', valueDateTime: info.voidedAtISO },
    ...(info.notes ? [{ url: 'notes', valueString: info.notes }] : []),
  ],
});

export const parsePaymentVoidFromNotice = (notice: PaymentNotice): PaymentVoidInfo | undefined => {
  const voidExtension = notice.extension?.find((ext) => ext.url === PAYMENT_VOID_EXTENSION_URL);
  if (!voidExtension?.extension) return undefined;
  const field = (url: string): Extension | undefined => voidExtension.extension?.find((ext) => ext.url === url);
  const reason = field('reason')?.valueString;
  const voidedAtISO = field('voidedAt')?.valueDateTime;
  if (!reason || !voidedAtISO) return undefined;
  return { reason, voidedAtISO, notes: field('notes')?.valueString };
};
