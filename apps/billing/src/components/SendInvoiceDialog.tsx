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
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { buildInvoicePlaceholders, parseInvoiceConfigFromQR } from 'utils/lib/helpers/rcm/invoice-config';
import { BRANDING_CONFIG } from 'utils/lib/ottehr-config/branding';
import { BillingClaimItem, GetBillingInvoiceRecipientResponse } from 'utils/lib/types/data/billing/billing.types';
import { createBillingInvoice, getBillingInvoiceRecipient, getInvoiceConfig } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { DateInput } from './DateInput';
import { InvoiceTemplateField } from './InvoiceTemplateField';

interface SendInvoiceForm {
  amount: number;
  dueDate: string;
  smsMessage: string;
  memo: string;
}

// Same fallbacks as the EHR dialog. The links only exist once the invoice is sent.
const PREVIEW_FALLBACKS: Record<string, string> = {
  'patient-full-name': '[Patient Name]',
  location: '[Location]',
  'visit-date': '[Visit Date]',
  'due-date': '[Due Date]',
  amount: '[Amount]',
  'invoice-link': 'https://example.com/invoice-link',
  'patient-portal-link': 'https://example.com/patient-portal',
};

interface SendInvoiceDialogProps {
  claim: BillingClaimItem;
  onClose: () => void;
  onSent: () => void;
}

export function SendInvoiceDialog({ claim, onClose, onSent }: SendInvoiceDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  // A retry with the same amount and due date reuses the key, so it resumes the invoice it started.
  const lastAttempt = useRef<{ idempotencyKey: string; amountCents: number; dueDate: string } | null>(null);
  const [recipient, setRecipient] = useState<GetBillingInvoiceRecipientResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [sendError, setSendError] = useState<string | null>(null);
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SendInvoiceForm>();

  const { id: claimId, claimBalance } = claim;
  useEffect(() => {
    if (!oystehrZambda) return;
    let active = true;
    setLoadError(null);
    void Promise.all([getInvoiceConfig(oystehrZambda), getBillingInvoiceRecipient(oystehrZambda, { claimId })])
      .then(([config, details]) => {
        if (!active) return;
        const { dueDaysFromGeneration, defaultSmsTemplate, defaultInvoiceMemo } = parseInvoiceConfigFromQR(
          config.questionnaireResponse
        );
        reset({
          amount: Math.max(Math.round(claimBalance * 100) / 100, 0),
          dueDate: DateTime.now().plus({ days: dueDaysFromGeneration }).toISODate() ?? '',
          smsMessage: defaultSmsTemplate,
          memo: defaultInvoiceMemo,
        });
        setRecipient(details);
      })
      .catch((error) => {
        if (active) setLoadError(getApiError({ error, defaultError: 'Failed to load invoice details' }));
      });
    return () => {
      active = false;
    };
  }, [oystehrZambda, claimId, claimBalance, loadAttempt, reset]);

  const amount = watch('amount');
  const previewValues = buildInvoicePlaceholders(
    {
      patientFullName: recipient?.patient.fullName,
      clinic: BRANDING_CONFIG.projectName,
      location: recipient?.location,
      visitDate: recipient?.visitDate,
      dueDate: watch('dueDate'),
      amountCents: amount > 0 ? Math.round(amount * 100) : undefined,
    },
    PREVIEW_FALLBACKS
  );

  const onSubmit = async (values: SendInvoiceForm): Promise<void> => {
    if (!oystehrZambda) return;
    setSendError(null);
    const amountCents = Math.round(values.amount * 100);
    if (lastAttempt.current?.amountCents !== amountCents || lastAttempt.current.dueDate !== values.dueDate) {
      lastAttempt.current = { idempotencyKey: crypto.randomUUID(), amountCents, dueDate: values.dueDate };
    }
    try {
      const { smsSent } = await createBillingInvoice(oystehrZambda, {
        claimId,
        amountCents,
        dueDate: values.dueDate,
        smsMessage: values.smsMessage,
        memo: values.memo,
        idempotencyKey: lastAttempt.current.idempotencyKey,
      });
      if (smsSent) enqueueSnackbar('Invoice sent', { variant: 'success' });
      else enqueueSnackbar('Invoice emailed, but the SMS could not be sent', { variant: 'warning' });
      onSent();
    } catch (error) {
      setSendError(getApiError({ error, defaultError: 'Failed to send invoice' }));
    }
  };

  const responsibleParty = recipient?.responsibleParty;
  const { ref: amountRef, ...amountField } = register('amount', {
    valueAsNumber: true,
    validate: (value) => value > 0 || 'Amount must be greater than 0',
  });

  return (
    <Dialog
      open
      onClose={isSubmitting ? undefined : onClose}
      maxWidth={false}
      PaperProps={{ sx: { width: 760, maxWidth: '95vw' } }}
    >
      <DialogTitle sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5">Send Invoice</Typography>
        <IconButton size="small" onClick={onClose} disabled={isSubmitting} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 0 }}>
        {loadError ? (
          <Alert severity="error" action={<Button onClick={() => setLoadAttempt((value) => value + 1)}>Retry</Button>}>
            {loadError}
          </Alert>
        ) : !recipient ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} aria-label="Loading invoice details" />
          </Box>
        ) : (
          <Stack
            component="form"
            id="send-invoice-form"
            noValidate
            onSubmit={handleSubmit(onSubmit)}
            spacing={3}
            sx={{ pt: 0.5 }}
          >
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Patient
              </Typography>
              <Typography fontWeight={600}>{recipient.patient.fullName}</Typography>
              <Stack direction="row" spacing={2}>
                <Typography variant="body2">{recipient.patient.dob}</Typography>
                <Typography variant="body2">{recipient.patient.gender}</Typography>
                <Typography variant="body2">{recipient.patient.phoneNumber}</Typography>
              </Stack>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Responsible party
              </Typography>
              <Typography fontWeight={600}>{responsibleParty?.fullName}</Typography>
              <Stack direction="row" spacing={2}>
                {responsibleParty?.email ? (
                  <Typography variant="body2">{responsibleParty.email}</Typography>
                ) : (
                  <Typography variant="body2" color="text.disabled">
                    Doesn&apos;t have email
                  </Typography>
                )}
                <Typography variant="body2">{responsibleParty?.phoneNumber}</Typography>
              </Stack>
            </Box>
            <Stack component="fieldset" disabled={isSubmitting} spacing={3} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  {...amountField}
                  inputRef={amountRef}
                  label="Amount, $"
                  type="number"
                  size="small"
                  required
                  fullWidth
                  inputProps={{ min: 0.01, step: 0.01 }}
                  error={!!errors.amount}
                  helperText={errors.amount?.message}
                />
                <Controller
                  name="dueDate"
                  control={control}
                  rules={{
                    validate: (value) =>
                      (!!value && DateTime.fromISO(value).startOf('day') > DateTime.now().startOf('day')) ||
                      'Due date must be in the future',
                  }}
                  render={({ field, fieldState }) => (
                    <DateInput
                      label="Due date"
                      value={field.value}
                      onChange={field.onChange}
                      fullWidth
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              </Stack>
              {(
                [
                  ['smsMessage', 'SMS message'],
                  ['memo', 'Invoice memo'],
                ] as const
              ).map(([name, label]) => (
                <Controller
                  key={name}
                  name={name}
                  control={control}
                  rules={{ validate: (value) => value.trim().length > 0 }}
                  render={({ field, fieldState }) => (
                    <InvoiceTemplateField
                      label={label}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      inputRef={field.ref}
                      error={!!fieldState.error}
                      disabled={isSubmitting}
                      isSms={name === 'smsMessage'}
                      previewValues={previewValues}
                    />
                  )}
                />
              ))}
            </Stack>
            {!responsibleParty?.email && (
              <Alert severity="error">
                Invoice cannot be sent because the responsible party does not have an email address on file.
              </Alert>
            )}
            {sendError && <Alert severity="error">{sendError}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2.5 }}>
        <Button onClick={onClose} disabled={isSubmitting} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="send-invoice-form"
          variant="contained"
          startIcon={isSubmitting ? <CircularProgress size={14} /> : undefined}
          disabled={!recipient || !responsibleParty?.email || isSubmitting}
        >
          {isSubmitting ? 'Sending...' : 'Send Invoice'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
