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
  FormHelperText,
  FormLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  ListItemText,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import { ReactElement, useEffect, useRef, useState } from 'react';
import { Control, Controller, useForm } from 'react-hook-form';
import { CreditCardBrandIcon } from 'ui-components/lib/components/CreditCardBrandIcon';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { paymentDayOf } from 'utils/lib/helpers/rcm/payment-day';
import { ServiceMode } from 'utils/lib/types/common';
import { TIMEZONES } from 'utils/lib/types/constants';
import { BillingPatientCard, BillingPatientVisit } from 'utils/lib/types/data/billing/billing.types';
import { DISPLAY_DATE_AND_TIME_FORMAT } from 'utils/lib/utils/dateUtils';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';
import { listBillingPatientPaymentMethods, postBillingPatientPayment, recordBillingManualPayment } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { DateInput } from './DateInput';

// mirrors the EHR visit-details payment dialog; a card reader payment is keyed in like cash here,
// since payments taken on a Stripe-connected reader record themselves
type DialogPaymentMethod = 'card' | 'card-reader' | 'cash' | 'check';

const PAYMENT_METHOD_OPTIONS: { value: DialogPaymentMethod; label: string }[] = [
  { value: 'card', label: 'Card' },
  { value: 'card-reader', label: 'Card Reader' },
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
];

interface PaymentForm {
  encounterId: string;
  amount: string;
  paymentMethod: DialogPaymentMethod;
  cardId: string;
  paymentDate: string;
  checkNumber: string;
}

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

const todayInPractice = (): string => paymentDayOf(DateTime.now().toISO() ?? '');

const defaultValues = (visits: BillingPatientVisit[]): PaymentForm => ({
  encounterId: visits[0]?.encounterId ?? '',
  amount: '',
  paymentMethod: 'card',
  cardId: '',
  paymentDate: todayInPractice(),
  checkNumber: '',
});

const visitTypeLabel = (visit: BillingPatientVisit): string | undefined => {
  if (visit.followUp) return 'Follow-up';
  if (visit.serviceMode === ServiceMode.virtual) return 'Telemed';
  if (visit.serviceMode === ServiceMode['in-person']) return 'In-Person';
  return undefined;
};

const visitLabel = (visit: BillingPatientVisit): { primary: string; secondary: string } => {
  const visitDate = visit.visitDateISO ? DateTime.fromISO(visit.visitDateISO) : undefined;
  const date = visitDate?.isValid ? visitDate.toFormat(DISPLAY_DATE_AND_TIME_FORMAT) : 'Visit with no date';
  const join = (parts: (string | undefined)[]): string => parts.filter(Boolean).join(' · ');
  return {
    primary: join([date, visitTypeLabel(visit)]),
    secondary: join([visit.locationName, visit.visitReason]),
  };
};

const visitSummary = (visit: BillingPatientVisit): string => {
  const { primary, secondary } = visitLabel(visit);
  return [primary, secondary].filter(Boolean).join(' · ');
};

const cardLabel = (card: BillingPatientCard): string => {
  const brand = card.brand ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1) : 'Card';
  const expiry = `${String(card.expMonth).padStart(2, '0')}/${String(card.expYear).slice(-2)}`;
  return `${brand} •••• ${card.lastFour} (exp ${expiry})${card.default ? ' — Primary' : ''}`;
};

// The day is recorded in the practice's timezone; noon there keeps it on that day whatever the
// browser's offset.
const paymentDateToISO = (day: string): string | undefined =>
  DateTime.fromISO(day, { zone: TIMEZONES[0] }).set({ hour: 12 }).toISO() ?? undefined;

export function AddPatientPaymentDialog({
  open,
  onClose,
  onPaymentAdded,
  billingPatientId,
  clinicalPatientId,
  visits,
}: {
  open: boolean;
  onClose: () => void;
  onPaymentAdded: () => Promise<void> | void;
  billingPatientId: string;
  clinicalPatientId: string;
  // newest first
  visits: BillingPatientVisit[];
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  const { control, handleSubmit, watch, reset, setValue } = useForm<PaymentForm>({
    defaultValues: defaultValues(visits),
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [cards, setCards] = useState<BillingPatientCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState('');

  // The same payment resent (e.g. after a response was lost) reuses its key so the server dedupes it
  // instead of recording or charging twice; any change to the payment makes it a new one.
  const lastAttempt = useRef<{ idempotencyKey: string; signature: string } | null>(null);

  useEffect(() => {
    if (open) {
      reset(defaultValues(visits));
      setSubmitError('');
      lastAttempt.current = null;
    }
  }, [open, reset, visits]);

  const encounterId = watch('encounterId');
  const paymentMethod = watch('paymentMethod');
  const isCard = paymentMethod === 'card';

  useEffect(() => {
    if (!open || !isCard || !encounterId || !oystehrZambda) return;
    let cancelled = false;
    setCards([]);
    setCardsError('');
    setCardsLoading(true);
    setValue('cardId', '');
    listBillingPatientPaymentMethods(oystehrZambda, { patientId: billingPatientId, encounterId })
      .then((res) => {
        if (cancelled) return;
        setCards(res.cards);
        setValue('cardId', res.cards.find((card) => card.default)?.id ?? res.cards[0]?.id ?? '');
      })
      .catch((err) => {
        if (!cancelled) setCardsError(getApiError({ error: err, defaultError: 'Failed to load saved cards' }));
      })
      .finally(() => {
        if (!cancelled) setCardsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isCard, encounterId, billingPatientId, oystehrZambda, setValue]);

  const submit = async (form: PaymentForm): Promise<void> => {
    if (!oystehrZambda) return;
    const amountInCents = Math.round(Number(form.amount) * 100);
    const checkNumber = form.paymentMethod === 'check' ? form.checkNumber.trim() || undefined : undefined;
    const signature = JSON.stringify([
      form.encounterId,
      amountInCents,
      form.paymentMethod,
      form.paymentMethod === 'card' ? form.cardId : form.paymentDate,
      checkNumber,
    ]);
    if (lastAttempt.current?.signature !== signature) {
      lastAttempt.current = { idempotencyKey: crypto.randomUUID(), signature };
    }
    const { idempotencyKey } = lastAttempt.current;

    setSubmitting(true);
    setSubmitError('');
    try {
      if (form.paymentMethod === 'card') {
        await postBillingPatientPayment(oystehrZambda, {
          patientId: clinicalPatientId,
          encounterId: form.encounterId,
          paymentDetails: { paymentMethod: 'card', amountInCents, paymentMethodId: form.cardId, idempotencyKey },
        });
      } else {
        await recordBillingManualPayment(oystehrZambda, {
          encounterId: form.encounterId,
          amountInCents,
          paymentMethod: form.paymentMethod === 'card-reader' ? 'external-card-reader' : form.paymentMethod,
          paymentDateISO: paymentDateToISO(form.paymentDate),
          checkNumber,
          idempotencyKey,
        });
      }
    } catch (err) {
      setSubmitError(getApiError({ error: err, defaultError: 'Failed to save the payment' }));
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onClose();
    await onPaymentAdded();
  };

  const closeIfIdle = (): void => {
    if (!submitting) onClose();
  };

  return (
    <Dialog open={open} onClose={closeIfIdle} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography component="span" variant="h5">
          Add Payment
        </Typography>
        <IconButton size="small" onClick={closeIfIdle} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
          {submitError && <Alert severity="error">{submitError}</Alert>}
          <Controller
            name="encounterId"
            control={control}
            rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
            render={({ field, fieldState: { error } }) => (
              <FormControl size="small" fullWidth error={!!error}>
                <InputLabel id="payment-visit-label">Visit *</InputLabel>
                <Select
                  labelId="payment-visit-label"
                  label="Visit *"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  renderValue={(encounterId) => {
                    const visit = visits.find((v) => v.encounterId === encounterId);
                    return visit ? visitSummary(visit) : '';
                  }}
                >
                  {visits.map((visit) => {
                    const { primary, secondary } = visitLabel(visit);
                    return (
                      <MenuItem key={visit.encounterId} value={visit.encounterId}>
                        <ListItemText primary={primary} secondary={secondary || undefined} sx={{ my: 0 }} />
                      </MenuItem>
                    );
                  })}
                </Select>
                {error && <FormHelperText>{error.message}</FormHelperText>}
              </FormControl>
            )}
          />
          <Controller
            name="amount"
            control={control}
            rules={{
              required: REQUIRED_FIELD_ERROR_MESSAGE,
              validate: (value) =>
                (AMOUNT_PATTERN.test(value.trim()) && Number(value) > 0) ||
                'Enter an amount greater than $0 with at most 2 decimal places',
            }}
            render={({ field, fieldState: { error } }) => (
              <TextField
                label="Amount *"
                size="small"
                fullWidth
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                inputProps={{ inputMode: 'decimal' }}
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                error={!!error}
                helperText={error?.message}
              />
            )}
          />
          <Controller
            name="paymentMethod"
            control={control}
            render={({ field }) => (
              <FormControl>
                <FormLabel id="payment-method-label">Payment method *</FormLabel>
                <RadioGroup
                  row
                  aria-labelledby="payment-method-label"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                >
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <FormControlLabel
                      key={option.value}
                      value={option.value}
                      control={<Radio />}
                      label={option.label}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            )}
          />
          {isCard ? (
            <CardSelect control={control} cards={cards} loading={cardsLoading} error={cardsError} />
          ) : (
            <>
              {paymentMethod === 'card-reader' && (
                <Alert severity="info">
                  Records a payment taken on a card reader that isn&apos;t connected to Ottehr. Payments taken on
                  connected card readers are recorded automatically.
                </Alert>
              )}
              <Box sx={{ display: 'flex', gap: 2.5 }}>
                <Controller
                  name="paymentDate"
                  control={control}
                  rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                  render={({ field, fieldState: { error } }) => (
                    <DateInput
                      label="Payment Date *"
                      size="small"
                      fullWidth
                      value={field.value}
                      onChange={(value) => field.onChange(value)}
                      error={!!error}
                      helperText={error?.message}
                    />
                  )}
                />
                {paymentMethod === 'check' && (
                  <Controller
                    name="checkNumber"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        label="Check Number"
                        size="small"
                        fullWidth
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    )}
                  />
                )}
              </Box>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={closeIfIdle} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={submitting ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
          onClick={handleSubmit(submit)}
          disabled={submitting || (isCard && (cardsLoading || cards.length === 0))}
        >
          {isCard ? 'Process Payment' : 'Record Payment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CardSelect({
  control,
  cards,
  loading,
  error,
}: {
  control: Control<PaymentForm>;
  cards: BillingPatientCard[];
  loading: boolean;
  error: string;
}): ReactElement {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Loading saved cards…
        </Typography>
      </Box>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (cards.length === 0) {
    return (
      <Alert severity="info">
        The patient has no saved cards for this visit. Cards can be added from the visit in the EHR.
      </Alert>
    );
  }
  return (
    <Controller
      name="cardId"
      control={control}
      rules={{ required: 'Select a card' }}
      render={({ field, fieldState: { error: fieldError } }) => (
        <FormControl size="small" fullWidth error={!!fieldError}>
          <InputLabel id="payment-card-label">Card *</InputLabel>
          <Select
            labelId="payment-card-label"
            label="Card *"
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
          >
            {cards.map((card) => (
              <MenuItem key={card.id} value={card.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CreditCardBrandIcon brand={card.brand} />
                  {cardLabel(card)}
                </Box>
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>{fieldError?.message ?? 'The card is charged today.'}</FormHelperText>
        </FormControl>
      )}
    />
  );
}
