import { Alert, TextField } from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { BILLING_INVOICE_LIMITS } from 'utils/lib/types/data/billing/billing.constants';
import { BillingInvoiceDetail } from 'utils/lib/types/data/billing/billing.types';
import { formatCurrency } from 'utils/lib/utils/convert';
import { voidBillingNioInvoice } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { ConfirmDialog } from './ConfirmDialog';

export function VoidInvoiceDialog({
  open,
  onClose,
  onVoided,
  invoice,
}: {
  open: boolean;
  onClose: () => void;
  onVoided: () => Promise<unknown> | void;
  invoice: Pick<BillingInvoiceDetail, 'id' | 'number' | 'amount'>;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const trimmedReason = reason.trim();
  const tooLong = trimmedReason.length > BILLING_INVOICE_LIMITS.voidReasonLength;

  useEffect(() => {
    if (open) {
      setReason('');
      setSubmitError('');
    }
  }, [open]);

  const submit = async (): Promise<void> => {
    if (!oystehrZambda || !trimmedReason || tooLong) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await voidBillingNioInvoice(oystehrZambda, {
        invoiceId: invoice.id,
        reason: trimmedReason,
      });
    } catch (err) {
      setSubmitError(
        getApiError({
          error: err,
          defaultError: 'Failed to void the invoice',
        })
      );
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onClose();
    await onVoided();
  };

  return (
    <ConfirmDialog
      open={open}
      title="Void invoice"
      confirmLabel="Void"
      confirmColor="error"
      confirmDisabled={!trimmedReason || tooLong}
      loading={submitting}
      onConfirm={() => void submit()}
      onCancel={onClose}
      fields={
        <>
          <TextField
            label="Reason *"
            size="small"
            fullWidth
            multiline
            minRows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            error={tooLong}
            helperText={tooLong ? `No more than ${BILLING_INVOICE_LIMITS.voidReasonLength} characters` : undefined}
            sx={{
              mt: 2,
            }}
          />
          {submitError && (
            <Alert
              severity="error"
              sx={{
                mt: 2,
              }}
            >
              {submitError}
            </Alert>
          )}
        </>
      }
    >
      {`Are you sure you want to void invoice ${invoice.number ?? invoice.id} for ${formatCurrency(
        invoice.amount
      )}? A voided invoice can no longer be paid.`}
    </ConfirmDialog>
  );
}
