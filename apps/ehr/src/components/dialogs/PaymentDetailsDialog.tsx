import CloseIcon from '@mui/icons-material/Close';
import LoadingButton from '@mui/lab/LoadingButton';
import {
  Box,
  Button,
  capitalize,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useState } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import { CreditCardBrandIcon } from 'ui-components/lib/components/CreditCardBrandIcon';
import {
  PatientPaymentDTO,
  PAYMENT_REFUND_VOID_REASONS,
  PaymentRefundDTO,
  PaymentRefundVoidReason,
} from 'utils/lib/types/api/patient-payment-types';
import { APIError, isApiError } from 'utils/lib/types/errors';

interface PaymentDetailsDialogProps {
  open: boolean;
  payment: PatientPaymentDTO;
  encounterId: string;
  canManagePayments: boolean;
  onPaymentChanged: () => Promise<void>;
  handleClose: () => void;
}

const buttonSx = {
  fontWeight: 500,
  textTransform: 'none',
  borderRadius: 6,
} as const;

const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const formatCents = (cents: number): string => usdFormatter.format(cents / 100);
const formatDate = (iso: string): string => DateTime.fromISO(iso).toLocaleString(DateTime.DATETIME_SHORT);

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
        color: '#8A1538',
        backgroundColor: '#FBE9E7',
      }}
    />
  );
};

const methodLabel = (payment: PatientPaymentDTO): string => {
  if (payment.cardLast4) {
    return `${capitalize(payment.cardBrand ?? 'Card')} •••• ${payment.cardLast4}`;
  }
  return capitalize(payment.paymentMethod);
};

const refundStatusLabel = (refund: PaymentRefundDTO): string => {
  if (!refund.status) return 'unknown';
  return refund.status.replace(/_/g, ' ');
};

const isSettledRefund = (refund: PaymentRefundDTO): boolean =>
  refund.status !== 'failed' && refund.status !== 'canceled';

const REFUNDABLE_METHODS = ['card', 'card-reader', 'cash', 'check', 'external-card-reader'];
const VOIDABLE_METHODS = ['cash', 'check', 'external-card-reader'];
// refunds for these are recorded in the EHR only; the money goes back to the patient by hand
const MANUAL_REFUND_METHODS = ['cash', 'check', 'external-card-reader'];
const isManualRefundPayment = (payment: PatientPaymentDTO): boolean =>
  MANUAL_REFUND_METHODS.includes(payment.paymentMethod);

function PaymentActionDialog({
  action,
  payment,
  encounterId,
  onClose,
  onDone,
}: {
  action: 'refund' | 'void';
  payment: PatientPaymentDTO;
  encounterId: string;
  onClose: () => void;
  onDone: () => Promise<void>;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [reason, setReason] = useState<PaymentRefundVoidReason | ''>('');
  const [notes, setNotes] = useState('');

  // frozen at open so a mid-processing list refetch can't shift validation under the user
  const [remainingCents] = useState(() => payment.amountInCents - (payment.refundedAmountInCents ?? 0));
  const [amountText, setAmountText] = useState((remainingCents / 100).toFixed(2));

  const parsedAmountCents = Math.round(Number(amountText) * 100);
  const amountValid =
    action !== 'refund' ||
    (Number.isFinite(parsedAmountCents) && parsedAmountCents > 0 && parsedAmountCents <= remainingCents);
  const amountError =
    action === 'refund' && amountText.trim() !== '' && !amountValid
      ? `Enter an amount between $0.01 and ${formatCents(remainingCents)}`
      : undefined;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!oystehrZambda) throw new Error('Oystehr client is not available');
      await oystehrZambda.zambda.execute({
        id: action === 'refund' ? 'patient-payments-refund' : 'patient-payments-void',
        encounterId,
        paymentNoticeId: payment.fhirPaymentNotificationId,
        reason,
        ...(action === 'refund' ? { amountInCents: parsedAmountCents } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
    },
    onSuccess: async () => {
      enqueueSnackbar(action === 'refund' ? 'Refund issued successfully' : 'Payment voided successfully', {
        variant: 'success',
      });
      await onDone();
      onClose();
    },
    onError: (error) => {
      const message = isApiError(error)
        ? (error as APIError).message
        : `Something went wrong. Payment was not ${action === 'refund' ? 'refunded' : 'voided'}.`;
      enqueueSnackbar(message, { variant: 'error' });
    },
    retry: 0,
  });

  const processing = mutation.isPending;
  const showAmountError = !!amountError && !processing;

  return (
    <Dialog open onClose={processing ? undefined : onClose} maxWidth="xs" fullWidth>
      <IconButton
        aria-label="close"
        onClick={onClose}
        disabled={processing}
        size="medium"
        sx={{ position: 'absolute', right: 12, top: 12 }}
      >
        <CloseIcon fontSize="medium" sx={{ color: '#938B7D' }} />
      </IconButton>
      <DialogTitle variant="h4" color="primary.dark">
        {action === 'refund' ? 'Refund Payment' : 'Void Payment'}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {action === 'refund'
            ? isManualRefundPayment(payment)
              ? `Up to ${formatCents(
                  remainingCents
                )} can be recorded as refunded. Return the money to the patient directly — this only records the refund.`
              : `Up to ${formatCents(remainingCents)} can be refunded to the original credit card.`
            : 'The payment will be voided and no longer counted toward the total collected.'}
        </Typography>
        {action === 'refund' && (
          <TextField
            fullWidth
            required
            label="Refund amount"
            type="number"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            disabled={processing}
            error={showAmountError}
            helperText={showAmountError ? amountError : undefined}
            inputProps={{ min: 0.01, max: remainingCents / 100, step: 0.01 }}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            sx={{ mb: 2, mt: 0.5 }}
          />
        )}
        <TextField
          select
          fullWidth
          required
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value as PaymentRefundVoidReason)}
          disabled={processing}
          sx={{ mb: 2, mt: 0.5 }}
        >
          {PAYMENT_REFUND_VOID_REASONS.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          fullWidth
          multiline
          minRows={2}
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={processing}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" sx={buttonSx} disabled={processing} onClick={onClose}>
          Cancel
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <LoadingButton
          variant="contained"
          color="error"
          sx={buttonSx}
          disabled={!reason || !amountValid}
          loading={processing}
          onClick={() => mutation.mutate()}
        >
          {action === 'refund' ? 'Issue Refund' : 'Void Payment'}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

export default function PaymentDetailsDialog({
  open,
  payment,
  encounterId,
  canManagePayments,
  onPaymentChanged,
  handleClose,
}: PaymentDetailsDialogProps): ReactElement {
  const refundState = getRefundState(payment);
  const refundedCents = payment.refundedAmountInCents ?? 0;
  const netCents = payment.amountInCents - refundedCents;
  const refunds = payment.refunds ?? [];
  const [action, setAction] = useState<'refund' | 'void' | null>(null);

  const refundApplies =
    REFUNDABLE_METHODS.includes(payment.paymentMethod) &&
    !payment.voided &&
    netCents > 0 &&
    !!payment.fhirPaymentNotificationId;
  const voidApplies =
    VOIDABLE_METHODS.includes(payment.paymentMethod) &&
    !payment.voided &&
    refundedCents <= 0 &&
    !!payment.fhirPaymentNotificationId;

  const detailRows: { label: string; value: string | ReactElement }[] = [
    {
      label: 'Method',
      value: (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          {payment.cardBrand && <CreditCardBrandIcon brand={payment.cardBrand} />}
          <Typography variant="body2">{methodLabel(payment)}</Typography>
        </Box>
      ),
    },
    { label: 'Date', value: formatDate(payment.dateISO) },
    { label: 'Amount', value: formatCents(payment.amountInCents) },
    ...(payment.takenBy ? [{ label: 'Taken by', value: payment.takenBy }] : []),
    ...(refundState === 'partial' || refundState === 'full'
      ? [
          { label: 'Refunded', value: `-${formatCents(refundedCents)}` },
          { label: 'Net', value: formatCents(netCents) },
        ]
      : []),
    ...(payment.voided
      ? [
          ...(payment.voidReason ? [{ label: 'Void reason', value: payment.voidReason }] : []),
          ...(payment.voidNotes ? [{ label: 'Void notes', value: payment.voidNotes }] : []),
          ...(payment.voidedBy ? [{ label: 'Voided by', value: payment.voidedBy }] : []),
        ]
      : []),
    ...(payment.description ? [{ label: 'Description', value: payment.description }] : []),
    ...(payment.paymentMethod === 'card' && payment.stripePaymentId
      ? [{ label: 'Credit card payment', value: payment.stripePaymentId }]
      : []),
  ];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <IconButton
        aria-label="close"
        onClick={handleClose}
        size="medium"
        sx={{ position: 'absolute', right: 12, top: 12 }}
      >
        <CloseIcon fontSize="medium" sx={{ color: '#938B7D' }} />
      </IconButton>
      <DialogTitle variant="h4" color="primary.dark" sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        Payment Details
        <RefundChip state={refundState} />
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {detailRows.map((row) => (
            <Box key={row.label} sx={{ display: 'flex', gap: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ width: 130, flexShrink: 0 }}>
                {row.label}
              </Typography>
              {typeof row.value === 'string' ? (
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                  {row.value}
                </Typography>
              ) : (
                row.value
              )}
            </Box>
          ))}
        </Box>
        {refundState !== 'none' && (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              backgroundColor: '#FBE9E7',
              borderRadius: 1,
              borderLeft: '4px solid #8A1538',
            }}
          >
            <Typography variant="body2" sx={{ color: '#8A1538', fontWeight: 600 }}>
              {refundState === 'voided'
                ? `This payment has been voided${
                    payment.voidReason ? ` (${payment.voidReason.toLowerCase()})` : ''
                  } and is not counted toward the total collected.`
                : refundState === 'full'
                ? `This payment has been fully refunded${
                    isManualRefundPayment(payment) ? '' : ' to the credit card'
                  } and is not counted toward the total collected.`
                : `${formatCents(refundedCents)} of this payment has been refunded${
                    isManualRefundPayment(payment) ? '' : ' to the credit card'
                  }. Only the remaining ${formatCents(netCents)} counts toward the total collected.`}
            </Typography>
          </Box>
        )}
        {(refunds.length > 0 || refundState === 'partial' || refundState === 'full') && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" color="primary.dark" sx={{ mb: 0.5 }}>
              Transactions
            </Typography>
            <Table size="small" sx={{ '& td, & th': { px: 0, py: 0.5 } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      Payment
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatDate(payment.dateISO)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">succeeded</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{formatCents(payment.amountInCents)}</Typography>
                  </TableCell>
                </TableRow>
                {refunds.map((refund) => (
                  <TableRow key={refund.stripeRefundId}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        Refund
                      </Typography>
                      {!refund.stripeRefundId.startsWith('manual_') && (
                        <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                          {refund.stripeRefundId}
                        </Typography>
                      )}
                      {refund.reason && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {refund.reason.replace(/_/g, ' ')}
                        </Typography>
                      )}
                      {refund.notes && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {refund.notes}
                        </Typography>
                      )}
                      {refund.refundedBy && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          by {refund.refundedBy}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatDate(refund.dateISO)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        color={isSettledRefund(refund) ? undefined : 'text.secondary'}
                        sx={!isSettledRefund(refund) ? { textDecoration: 'line-through' } : undefined}
                      >
                        {refundStatusLabel(refund)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="error.main">
                        -{formatCents(refund.amountInCents)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
                {(refundState === 'partial' || refundState === 'full') && (
                  <TableRow sx={{ '& td': { borderBottom: 0 } }}>
                    <TableCell colSpan={3}>
                      <Typography variant="body2" fontWeight={700}>
                        Net
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={700}>
                        {formatCents(netCents)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {refundApplies && (
          <Tooltip title={canManagePayments ? '' : 'Only users with the Billing Admin role can refund payments'}>
            <span>
              <Button
                variant="outlined"
                color="error"
                sx={buttonSx}
                disabled={!canManagePayments}
                onClick={() => setAction('refund')}
              >
                {isManualRefundPayment(payment) ? 'Record Refund' : 'Refund Payment'}
              </Button>
            </span>
          </Tooltip>
        )}
        {voidApplies && (
          <Tooltip title={canManagePayments ? '' : 'Only users with the Billing Admin role can void payments'}>
            <span>
              <Button
                variant="outlined"
                color="error"
                sx={buttonSx}
                disabled={!canManagePayments}
                onClick={() => setAction('void')}
              >
                Void Payment
              </Button>
            </span>
          </Tooltip>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" sx={buttonSx} onClick={handleClose}>
          Close
        </Button>
      </DialogActions>
      {action && (
        <PaymentActionDialog
          action={action}
          payment={payment}
          encounterId={encounterId}
          onClose={() => setAction(null)}
          onDone={onPaymentChanged}
        />
      )}
    </Dialog>
  );
}
