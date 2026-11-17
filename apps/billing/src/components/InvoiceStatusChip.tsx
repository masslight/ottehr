import { Chip, ChipProps } from '@mui/material';
import { ReactElement } from 'react';
import { BillingInvoiceListStatus } from 'utils/lib/types/data/billing/billing.constants';

export const INVOICE_STATUS_CHIPS: Record<BillingInvoiceListStatus, { label: string; color: ChipProps['color'] }> = {
  issued: {
    label: 'Open',
    color: 'info',
  },
  balanced: {
    label: 'Paid',
    color: 'success',
  },
  cancelled: {
    label: 'Void',
    color: 'default',
  },
};

const PAST_DUE_CHIP = {
  label: 'Past due',
  color: 'error',
} as const;

export const getInvoiceStatusChip = (
  status: BillingInvoiceListStatus,
  pastDue?: boolean
): { label: string; color: ChipProps['color'] } => (pastDue ? PAST_DUE_CHIP : INVOICE_STATUS_CHIPS[status]);

export function InvoiceStatusChip({
  status,
  pastDue,
}: {
  status: BillingInvoiceListStatus;
  pastDue?: boolean;
}): ReactElement {
  const chip = getInvoiceStatusChip(status, pastDue);
  return (
    <Chip
      label={chip.label}
      color={chip.color}
      variant="outlined"
      size="small"
      sx={{
        borderRadius: '4px',
        fontSize: 12,
      }}
    />
  );
}
