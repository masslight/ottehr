import { PaymentNotice } from 'fhir/r4b';

const PAYMENT_STATUS_LABELS: Record<PaymentNotice['status'], string> = {
  active: 'Paid',
  cancelled: 'Cancelled',
  draft: 'Draft',
  'entered-in-error': 'Entered in error',
};

export const paymentStatusLabel = ({ status, amount }: { status: string; amount: number }): string => {
  if (status === 'active' && amount < 0) return 'Refunded';
  return PAYMENT_STATUS_LABELS[status as PaymentNotice['status']] ?? status;
};
