import { Close as CloseIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useRef, useState } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import {
  PAYMENT_REFUND_MEDIUMS,
  PAYMENT_REFUND_VOID_REASONS,
  PaymentRefundMedium,
  PaymentRefundVoidReason,
} from 'utils/lib/types/api/patient-payment-types';
import { BillingPatientAccountPayment } from 'utils/lib/types/data/billing/billing.types';
import { formatCurrency } from 'utils/lib/utils/convert';
import { refundBillingPatientPayment, voidBillingPatientPayment } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';

export type PaymentAction = 'refund' | 'external-refund' | 'void';

export const REFUND_MEDIUM_LABELS: Record<PaymentRefundMedium, string> = {
  'external-card-reader': 'External card reader',
  cash: 'Cash',
  check: 'Check',
  other: 'Other',
};

// no processor link for these, so their refunds are recorded only and the money goes back by hand
export const MANUAL_REFUND_METHODS = ['cash', 'check', 'external-card-reader'];

const TITLES: Record<PaymentAction, string> = {
  refund: 'Refund Payment',
  'external-refund': 'Record External Refund',
  void: 'Void Payment',
};

const cents = (amountInCents: number): string => formatCurrency(amountInCents / 100);

export function PaymentActionDialog({
  action,
  payment,
  onClose,
  onDone,
}: {
  action: PaymentAction;
  payment: BillingPatientAccountPayment;
  onClose: () => void;
  onDone: () => Promise<void>;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  const isRefund = action !== 'void';
  const isManual = MANUAL_REFUND_METHODS.includes(payment.paymentMethod);

  // frozen at open so a refetch while submitting can't shift validation under the user
  const [remainingCents] = useState(() => payment.amountInCents - (payment.refundedAmountInCents ?? 0));
  const [amountText, setAmountText] = useState((remainingCents / 100).toFixed(2));
  const [reason, setReason] = useState<PaymentRefundVoidReason | ''>('');
  const [medium, setMedium] = useState<PaymentRefundMedium | ''>('');
  const [notes, setNotes] = useState('');
  // stable per dialog open so a retry resumes the same refund instead of recording a second one
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  // The server scopes the idempotency key to the notice id sent, and a legacy payment's id changes to its
  // billing copy's once the first attempt adopts it; a retry must still send the id the key was used with.
  const [target] = useState(() => ({
    encounterId: payment.encounterId,
    paymentNoticeId: payment.fhirPaymentNotificationId,
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A failed request may still have been applied (e.g. the refund was stamped but the Candid sync
  // failed), so after a failure the form is locked to what was sent: a retry with the same key and
  // payload resumes that operation, while changing anything means closing and starting over from the
  // reloaded balance.
  const [failed, setFailed] = useState(false);
  const locked = submitting || failed;

  // The page owns one dialog slot, and the user can leave this payment (and open another's dialog) while a
  // request is in flight. Once this dialog is gone its request must not reload or close what replaced it.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const amountCents = Math.round(Number(amountText) * 100);
  const amountValid = !isRefund || (Number.isFinite(amountCents) && amountCents > 0 && amountCents <= remainingCents);
  const amountError =
    isRefund && amountText.trim() !== '' && !amountValid
      ? `Enter an amount between $0.01 and ${cents(remainingCents)}`
      : undefined;
  const canSubmit = !!reason && amountValid && (action !== 'external-refund' || !!medium) && !submitting;
  const operation = isRefund ? 'refund' : 'void';

  const description =
    action === 'void'
      ? 'The payment will be voided and no longer counted toward the total collected.'
      : action === 'external-refund'
      ? `Up to ${cents(
          remainingCents
        )} can be recorded as refunded. No money moves through Stripe — return it to the patient separately; this only records the refund.`
      : isManual
      ? `Up to ${cents(
          remainingCents
        )} can be recorded as refunded. Return the money to the patient directly — this only records the refund.`
      : `Up to ${cents(remainingCents)} can be refunded to the original card.`;

  const submit = async (): Promise<void> => {
    if (!oystehrZambda || !reason || !target.paymentNoticeId) return;
    setSubmitting(true);
    setError(null);
    const common = {
      encounterId: target.encounterId,
      paymentNoticeId: target.paymentNoticeId,
      reason,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    try {
      if (action === 'void') {
        await voidBillingPatientPayment(oystehrZambda, common);
      } else {
        await refundBillingPatientPayment(oystehrZambda, {
          ...common,
          amountInCents: amountCents,
          idempotencyKey,
          ...(action === 'external-refund' && medium ? { external: true, medium } : {}),
        });
      }
      enqueueSnackbar(
        action === 'void'
          ? 'Payment voided'
          : action === 'external-refund'
          ? 'External refund recorded'
          : 'Refund issued',
        { variant: 'success' }
      );
      if (!mountedRef.current) return;
      await onDone();
      if (mountedRef.current) onClose();
    } catch (err) {
      if (!mountedRef.current) return;
      setFailed(true);
      setError(getApiError({ error: err, defaultError: `Something went wrong while processing the ${operation}.` }));
      // the outcome is uncertain, so reload the payment: its transactions show whether this went through
      void onDone();
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  return (
    <Dialog open onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography component="span" variant="h5">
          {TITLES[action]}
        </Typography>
        <IconButton size="small" onClick={onClose} disabled={submitting} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
          {error && (
            <Alert severity="error">
              {error}
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                The {operation} may still have gone through. Check the payment&apos;s transactions before retrying; a
                retry resumes this same {operation} and won&apos;t record a second one.
              </Typography>
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
          {isRefund && (
            <TextField
              label="Refund Amount *"
              size="small"
              fullWidth
              type="number"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              disabled={locked}
              error={!!amountError}
              helperText={amountError}
              inputProps={{ min: 0.01, max: remainingCents / 100, step: 0.01 }}
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            />
          )}
          {action === 'external-refund' && (
            <TextField
              select
              label="Refunded Via *"
              size="small"
              fullWidth
              value={medium}
              onChange={(e) => setMedium(e.target.value as PaymentRefundMedium)}
              disabled={locked}
            >
              {PAYMENT_REFUND_MEDIUMS.map((option) => (
                <MenuItem key={option} value={option}>
                  {REFUND_MEDIUM_LABELS[option]}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            select
            label="Reason *"
            size="small"
            fullWidth
            value={reason}
            onChange={(e) => setReason(e.target.value as PaymentRefundVoidReason)}
            disabled={locked}
          >
            {PAYMENT_REFUND_VOID_REASONS.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Notes"
            size="small"
            fullWidth
            multiline
            minRows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={locked}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2.5 }}>
        <Button onClick={onClose} disabled={submitting} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => void submit()}
          disabled={!canSubmit}
          startIcon={submitting ? <CircularProgress size={14} /> : undefined}
        >
          {failed
            ? 'Retry'
            : action === 'void'
            ? 'Void Payment'
            : action === 'external-refund'
            ? 'Record Refund'
            : 'Issue Refund'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
