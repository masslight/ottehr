import { PaymentNotice } from 'fhir/r4b';

const PAYMENT_STATUS_LABELS: Record<PaymentNotice['status'], string> = {
  active: 'Paid',
  cancelled: 'Cancelled',
  draft: 'Draft',
  'entered-in-error': 'Entered in error',
};

// A refund's reconciliation outcome is queued until it settles and error if it fails.
const UNSETTLED_REFUND_OUTCOMES = ['queued', 'error'];

export const paymentStatusLabel = ({
  status,
  amount,
  outcome,
}: {
  status: string;
  amount: number;
  outcome?: string;
}): string => {
  if (status === 'active' && amount < 0) {
    return outcome && UNSETTLED_REFUND_OUTCOMES.includes(outcome) ? 'Refund pending' : 'Refunded';
  }
  return PAYMENT_STATUS_LABELS[status as PaymentNotice['status']] ?? status;
};
