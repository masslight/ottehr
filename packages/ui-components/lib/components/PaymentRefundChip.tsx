import { alpha, Chip } from '@mui/material';
import { ReactElement } from 'react';
import { PatientPaymentDTO } from 'utils/lib/types/api/patient-payment-types';

export type PaymentRefundState = 'none' | 'partial' | 'full' | 'voided';

export const getRefundState = (payment: PatientPaymentDTO): PaymentRefundState => {
  if (payment.voided) return 'voided';
  const refunded = payment.refundedAmountInCents ?? 0;
  if (refunded <= 0) return 'none';
  return refunded >= payment.amountInCents ? 'full' : 'partial';
};

export const RefundChip = ({
  state,
  size = 'small',
}: {
  state: PaymentRefundState;
  size?: 'small' | 'medium';
}): ReactElement | null => {
  if (state === 'none') return null;
  return (
    <Chip
      label={state === 'voided' ? 'VOIDED' : state === 'full' ? 'REFUNDED' : 'PARTIALLY REFUNDED'}
      size={size}
      sx={{
        fontSize: '0.65rem',
        fontWeight: 700,
        letterSpacing: '0.4px',
        height: 20,
        color: 'error.dark',
        backgroundColor: (theme) => alpha(theme.palette.error.light, 0.12),
      }}
    />
  );
};
