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
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import { ReactElement, useRef, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { getApiError, getApiErrorCode } from 'utils/lib/helpers/oystehrApi';
import { uploadObjectToZ3 } from 'utils/lib/helpers/presigned-file-url/helpers';
import { FUTURE_PAYMENT_DATE_ERROR, isFuturePaymentDay, practiceToday } from 'utils/lib/helpers/rcm/payment-day';
import { TIMEZONES } from 'utils/lib/types/constants';
import {
  BILLING_INVOICE_LIMITS,
  BILLING_INVOICE_PAYMENT_METHODS,
} from 'utils/lib/types/data/billing/billing.constants';
import { RecordBillingNioInvoicePaymentInput } from 'utils/lib/types/data/billing/billing.schemas';
import { BillingInvoiceDetail } from 'utils/lib/types/data/billing/billing.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';
import { presignBillingInvoicePaymentAttachment, recordBillingNioInvoicePayment } from '../api/api';
import { invoicePaymentMethodLabel } from '../constants/invoice';
import { useApiClients } from '../hooks/useAppClients';
import { MAX_ATTACHMENT_BYTES } from './attachments/AttachmentsSection';
import { DateInput } from './DateInput';
import { DropzoneField } from './DropzoneField';
import { PaymentAmountField, toAmountInCents } from './PaymentAmountField';

type InvoicePaymentMethod = (typeof BILLING_INVOICE_PAYMENT_METHODS)[number];

interface InvoicePaymentForm {
  amount: string;
  paymentDate: string;
  paymentMethod: InvoicePaymentMethod;
  reference: string;
  file: File | null;
}

const ATTACHMENT_ACCEPT = {
  'image/*': ['.jpeg', '.jpg', '.png'],
  'application/pdf': ['.pdf'],
};

export interface ManualPaymentAttempt {
  payment: RecordBillingNioInvoicePaymentInput;
  file: File | null;
}

const defaultValues = (balance: number, attempt: ManualPaymentAttempt | null): InvoicePaymentForm =>
  attempt
    ? {
        amount: (attempt.payment.amountInCents / 100).toFixed(2),
        paymentDate: attempt.payment.paymentDate,
        paymentMethod: attempt.payment.paymentMethod,
        reference: attempt.payment.reference ?? '',
        file: attempt.file,
      }
    : {
        amount: balance.toFixed(2),
        paymentDate: practiceToday(DateTime.now()),
        paymentMethod: 'check',
        reference: '',
        file: null,
      };

const isRefusedPayment = (error: unknown): boolean => getApiErrorCode(error) === APIErrorCode.INVALID_INPUT;

export function RecordInvoicePaymentDialog({
  open,
  onClose,
  onRecorded,
  invoice,
  unresolvedAttempt,
  onUnresolvedAttemptChange,
}: {
  open: boolean;
  onClose: () => void;
  onRecorded: () => Promise<unknown> | void;
  invoice: Pick<BillingInvoiceDetail, 'id' | 'balance'>;
  // a payment that may have been recorded; reopening resends it
  unresolvedAttempt: ManualPaymentAttempt | null;
  onUnresolvedAttemptChange: (attempt: ManualPaymentAttempt | null) => void;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  // fixed at opening, so a refetch can't block a retry
  const [openedBalance] = useState(invoice.balance ?? 0);
  const methods = useForm<InvoicePaymentForm>({
    defaultValues: defaultValues(openedBalance, unresolvedAttempt),
  });
  const { control, handleSubmit } = methods;
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const retryOnly = unresolvedAttempt !== null;
  const locked = submitting || retryOnly;

  const upload = useRef<{
    file: File;
    attachment: RecordBillingNioInvoicePaymentInput['attachment'];
  } | null>(null);

  const showError = (err: unknown): void =>
    setSubmitError(
      getApiError({
        error: err,
        defaultError: 'Failed to record the payment',
      })
    );

  const record = async (attempt: ManualPaymentAttempt): Promise<void> => {
    if (!oystehrZambda) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await recordBillingNioInvoicePayment(oystehrZambda, attempt.payment);
    } catch (err) {
      showError(err);
      onUnresolvedAttemptChange(isRefusedPayment(err) ? null : attempt);
      setSubmitting(false);
      return;
    }
    onUnresolvedAttemptChange(null);
    setSubmitting(false);
    onClose();
    await onRecorded();
  };

  const uploadAttachment = async (file: File): Promise<RecordBillingNioInvoicePaymentInput['attachment']> => {
    if (upload.current?.file === file) return upload.current.attachment;
    const { uploadUrl, path } = await presignBillingInvoicePaymentAttachment(oystehrZambda!, {
      invoiceId: invoice.id,
      fileName: file.name,
    });
    await uploadObjectToZ3(file, uploadUrl, file.type);
    const attachment = {
      path,
      fileName: file.name,
      ...(file.type
        ? {
            mimeType: file.type,
          }
        : {}),
    };
    upload.current = {
      file,
      attachment,
    };
    return attachment;
  };

  const submit = async (form: InvoicePaymentForm): Promise<void> => {
    if (!oystehrZambda) return;
    setSubmitting(true);
    setSubmitError('');
    let attachment: RecordBillingNioInvoicePaymentInput['attachment'];
    try {
      attachment = form.file ? await uploadAttachment(form.file) : undefined;
    } catch (err) {
      showError(err);
      setSubmitting(false);
      return;
    }
    await record({
      payment: {
        invoiceId: invoice.id,
        amountInCents: toAmountInCents(form.amount),
        paymentMethod: form.paymentMethod,
        paymentDate: form.paymentDate,
        reference: form.reference.trim() || undefined,
        attachment,
        idempotencyKey: crypto.randomUUID(),
      },
      file: form.file,
    });
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
                  validate: (value) => !isFuturePaymentDay(value, DateTime.now()) || FUTURE_PAYMENT_DATE_ERROR,
                }}
                render={({ field, fieldState: { error } }) => (
                  <DateInput
                    label="Payment date *"
                    size="small"
                    fullWidth
                    timezone={TIMEZONES[0]}
                    value={field.value}
                    onChange={(value) => field.onChange(value)}
                    disabled={locked}
                    error={!!error}
                    helperText={error?.message}
                  />
                )}
              />
              <PaymentAmountField
                control={control}
                name="amount"
                maxInCents={Math.round(openedBalance * 100)}
                disabled={locked}
              />
            </Box>
            <Controller
              name="paymentMethod"
              control={control}
              render={({ field }) => (
                <FormControl disabled={locked}>
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
                  disabled={locked}
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
              disabled={locked}
            />
          </Box>
        </FormProvider>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={closeIfIdle}
          disabled={submitting}
          sx={{
            mr: 'auto',
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={submitting ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
          onClick={unresolvedAttempt ? () => void record(unresolvedAttempt) : handleSubmit(submit)}
          disabled={submitting}
        >
          {retryOnly ? 'Try again' : 'Record payment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
