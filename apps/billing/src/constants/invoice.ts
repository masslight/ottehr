import { BILLING_INVOICE_PAYMENT_METHODS } from 'utils/lib/types/data/billing/billing.constants';

const INVOICE_PAYMENT_METHOD_LABELS: Record<(typeof BILLING_INVOICE_PAYMENT_METHODS)[number] | 'card', string> = {
  cash: 'Cash',
  card: 'Card',
  check: 'Check',
  ach: 'ACH',
  wire: 'Wire',
  other: 'Other',
};

export const invoicePaymentMethodLabel = (method: string): string =>
  INVOICE_PAYMENT_METHOD_LABELS[method as keyof typeof INVOICE_PAYMENT_METHOD_LABELS] ?? method;
