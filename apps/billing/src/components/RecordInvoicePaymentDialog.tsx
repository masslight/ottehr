import { Close as CloseIcon, Save as SaveIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  InputAdornment,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import { ReactElement, useEffect, useRef, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { uploadObjectToZ3 } from 'utils/lib/helpers/presigned-file-url/helpers';
import { paymentDayOf } from 'utils/lib/helpers/rcm/payment-day';
import {
  BILLING_INVOICE_LIMITS,
  BILLING_INVOICE_PAYMENT_METHODS,
} from 'utils/lib/types/data/billing/billing.constants';
import { RecordBillingNioInvoicePaymentInput } from 'utils/lib/types/data/billing/billing.schemas';
import { BillingInvoiceDetail } from 'utils/lib/types/data/billing/billing.types';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';
import { presignBillingInvoicePaymentAttachment, recordBillingNioInvoicePayment } from '../api/api';
import { invoicePaymentMethodLabel } from '../constants/invoice';
import { useApiClients } from '../hooks/useAppClients';
import { MAX_ATTACHMENT_BYTES } from './attachments/AttachmentsSection';
import { DateInput } from './DateInput';
import { DropzoneField } from './DropzoneField';

type InvoicePaymentMethod = (typeof BILLING_INVOICE_PAYMENT_METHODS)[number];

interface InvoicePaymentForm {
  paymentDate: string;
  paymentMethod: InvoicePaymentMethod;
  reference: string;
  file: File | null;
}

const ATTACHMENT_ACCEPT = {
  'image/*': ['.jpeg', '.jpg', '.png'],
  'application/pdf': ['.pdf'],
};

const defaultValues = (): InvoicePaymentForm => ({
  paymentDate: paymentDayOf(DateTime.now().toISO() ?? ''),
  paymentMethod: 'check',
  reference: '',
  file: null,
});

export function RecordInvoicePaymentDialog({
  open,
  onClose,
  onRecorded,
  invoice,
}: {
  open: boolean;
  onClose: () => void;
  onRecorded: () => Promise<unknown> | void;
  invoice: Pick<BillingInvoiceDetail, 'id' | 'balance'>;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  const methods = useForm<InvoicePaymentForm>({
    defaultValues: defaultValues(),
  });
  const { control, handleSubmit, reset } = methods;
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const balance = invoice.balance ?? 0;

  // A resent payment reuses its key, invoice, amount and uploaded file, so it's recorded once even
  // after a refetch drops the balance it paid.
  const lastAttempt = useRef<{
    idempotencyKey: string;
    signature: string;
    invoiceId: string;
    amountInCents: number;
    attachment?: RecordBillingNioInvoicePaymentInput['attachment'];
  } | null>(null);

  useEffect(() => {
    if (open) {
      reset(defaultValues());
      setSubmitError('');
      lastAttempt.current = null;
    }
  }, [open, reset]);

  const submit = async (form: InvoicePaymentForm): Promise<void> => {
    if (!oystehrZambda) return;
    const reference = form.reference.trim() || undefined;
    const signature = JSON.stringify([
      form.paymentDate,
      form.paymentMethod,
      reference,
      form.file?.name,
      form.file?.size,
      form.file?.lastModified,
    ]);
    if (lastAttempt.current?.signature !== signature) {
      lastAttempt.current = {
        idempotencyKey: crypto.randomUUID(),
        signature,
        invoiceId: invoice.id,
        amountInCents: Math.round(balance * 100),
      };
    }
    const attempt = lastAttempt.current;
    const { idempotencyKey, invoiceId, amountInCents } = attempt;

    setSubmitting(true);
    setSubmitError('');
    try {
      if (form.file && !attempt.attachment) {
        const { uploadUrl, path } = await presignBillingInvoicePaymentAttachment(oystehrZambda, {
          invoiceId,
          fileName: form.file.name,
        });
        await uploadObjectToZ3(form.file, uploadUrl, form.file.type);
        attempt.attachment = {
          path,
          fileName: form.file.name,
          ...(form.file.type
            ? {
                mimeType: form.file.type,
              }
            : {}),
        };
      }
      const { attachment } = attempt;
      await recordBillingNioInvoicePayment(oystehrZambda, {
        invoiceId,
        amountInCents,
        paymentMethod: form.paymentMethod,
        paymentDate: form.paymentDate,
        reference,
        attachment,
        idempotencyKey,
      });
    } catch (err) {
      setSubmitError(
        getApiError({
          error: err,
          defaultError: 'Failed to record the payment',
        })
      );
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onClose();
    await onRecorded();
  };

  const closeIfIdle = (): void => {
    if (!submitting) onClose();
  };

  return (
    <Dialog open={open} onClose={closeIfIdle} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          px: 3,
          pt: 3,
          pb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography component="span" variant="h5">
          Record payment
        </Typography>
        <IconButton size="small" onClick={closeIfIdle} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <FormProvider {...methods}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2.5,
              mt: 1,
            }}
          >
            {submitError && <Alert severity="error">{submitError}</Alert>}
            <Box
              sx={{
                display: 'flex',
                gap: 2.5,
              }}
            >
              <Controller
                name="paymentDate"
                control={control}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                }}
                render={({ field, fieldState: { error } }) => (
                  <DateInput
                    label="Payment date *"
                    size="small"
                    fullWidth
                    value={field.value}
                    onChange={(value) => field.onChange(value)}
                    error={!!error}
                    helperText={error?.message}
                  />
                )}
              />
              <TextField
                label="Amount"
                size="small"
                fullWidth
                disabled
                value={balance.toFixed(2)}
                helperText="The full balance"
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
              />
            </Box>
            <Controller
              name="paymentMethod"
              control={control}
              render={({ field }) => (
                <FormControl>
                  <FormLabel id="invoice-payment-method-label">Payment method *</FormLabel>
                  <RadioGroup
                    row
                    aria-labelledby="invoice-payment-method-label"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                  >
                    {BILLING_INVOICE_PAYMENT_METHODS.map((method) => (
                      <FormControlLabel
                        key={method}
                        value={method}
                        control={<Radio />}
                        label={invoicePaymentMethodLabel(method)}
                      />
                    ))}
                  </RadioGroup>
                </FormControl>
              )}
            />
            <Controller
              name="reference"
              control={control}
              rules={{
                maxLength: {
                  value: BILLING_INVOICE_LIMITS.paymentReferenceLength,
                  message: `At most ${BILLING_INVOICE_LIMITS.paymentReferenceLength} characters`,
                },
              }}
              render={({ field, fieldState: { error } }) => (
                <TextField
                  label="Reference #"
                  size="small"
                  fullWidth
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  error={!!error}
                  helperText={error?.message}
                />
              )}
            />
            <DropzoneField
              name="file"
              multiple={false}
              accept={ATTACHMENT_ACCEPT}
              maxSize={MAX_ATTACHMENT_BYTES}
              ariaLabel="Upload attachment"
            />
          </Box>
        </FormProvider>
      </DialogContent>
      <DialogActions>
        <Button onClick={closeIfIdle} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={submitting ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
          onClick={handleSubmit(submit)}
          disabled={submitting}
        >
          Record payment
        </Button>
      </DialogActions>
    </Dialog>
  );
}
