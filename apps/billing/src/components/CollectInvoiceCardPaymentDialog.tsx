import { Close as CloseIcon, CreditCard as CreditCardIcon } from '@mui/icons-material';
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
  Typography,
} from '@mui/material';
import { Elements } from '@stripe/react-stripe-js';
import { useQuery } from '@tanstack/react-query';
import { ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { AddCreditCardForm } from 'ui-components/lib/components/AddCreditCardForm';
import { loadStripe } from 'ui-components/lib/utils/stripe';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { BillingInvoiceDetail } from 'utils/lib/types/data/billing/billing.types';
import { APIError, APIErrorCode } from 'utils/lib/types/errors';
import {
  chargeBillingNioInvoiceCard,
  listBillingNioInvoicePaymentMethods,
  setupBillingNioInvoiceCard,
} from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { CardSelect } from './CardSelect';
import { PaymentAmountField, STRIPE_MINIMUM_CHARGE_IN_CENTS, toAmountInCents } from './PaymentAmountField';

const REFUSED_CHARGE_CODES: unknown[] = [
  APIErrorCode.STRIPE_PAYMENT_ERROR_GENERIC,
  APIErrorCode.STRIPE_PAYMENT_ERROR_SPECIFIC,
  APIErrorCode.INVALID_INPUT,
];

const isRefusedCharge = (error: unknown): boolean =>
  REFUSED_CHARGE_CODES.includes((error as Partial<APIError> | undefined)?.code);

interface CardPaymentForm {
  amount: string;
  cardId: string;
}

function AddCardSection({
  invoiceId,
  onAdded,
}: {
  invoiceId: string;
  onAdded: (paymentMethodId: string) => Promise<void>;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  const setup = useQuery({
    queryKey: ['billing-nio-invoice-card-setup', invoiceId],
    enabled: Boolean(oystehrZambda),
    retry: false,
    gcTime: 0,
    queryFn: () =>
      setupBillingNioInvoiceCard(oystehrZambda!, {
        invoiceId,
      }),
  });
  const stripeAccount = setup.data?.stripeAccount;
  const stripePromise = useMemo(
    () => (setup.data ? loadStripe(import.meta.env.VITE_APP_STRIPE_KEY, stripeAccount) : null),
    [setup.data, stripeAccount]
  );

  if (setup.isPending) return <CircularProgress size={16} aria-label="Preparing card form" />;
  if (setup.isError) {
    return (
      <Alert severity="error">
        {getApiError({
          error: setup.error,
          defaultError: "The card form didn't load",
        })}
      </Alert>
    );
  }
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: setup.data.clientSecret,
      }}
    >
      <AddCreditCardForm
        clientSecret={setup.data.clientSecret}
        disabled={false}
        selectPaymentMethod={onAdded}
        condition="I have the payer's consent to keep this card on file"
        showAddButton
      />
    </Elements>
  );
}

export function CollectInvoiceCardPaymentDialog({
  open,
  onClose,
  onPaid,
  invoice,
}: {
  open: boolean;
  onClose: () => void;
  onPaid: () => Promise<unknown> | void;
  invoice: Pick<BillingInvoiceDetail, 'id' | 'balance'>;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  // the balance it opened with, so a refetch after a charge doesn't block a retry
  const [openedBalance] = useState(invoice.balance ?? 0);
  const { control, handleSubmit, setValue, watch } = useForm<CardPaymentForm>({
    defaultValues: {
      amount: openedBalance.toFixed(2),
      cardId: '',
    },
  });
  const [addingCard, setAddingCard] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [retryOnly, setRetryOnly] = useState(false);
  const cardId = watch('cardId');

  const lastAttempt = useRef<{
    idempotencyKey: string;
    cardId: string;
    amountInCents: number;
  } | null>(null);

  const cards = useQuery({
    queryKey: ['billing-nio-invoice-cards', invoice.id],
    enabled: open && Boolean(oystehrZambda),
    retry: false,
    queryFn: () =>
      listBillingNioInvoicePaymentMethods(oystehrZambda!, {
        invoiceId: invoice.id,
      }),
  });

  useEffect(() => {
    const [first] = cards.data?.cards ?? [];
    if (first && !cardId) setValue('cardId', first.id);
  }, [cards.data, cardId, setValue]);

  const addCard = async (paymentMethodId: string): Promise<void> => {
    await cards.refetch();
    setValue('cardId', paymentMethodId);
    setAddingCard(false);
  };

  const submit = async (form: CardPaymentForm): Promise<void> => {
    if (!oystehrZambda) return;
    lastAttempt.current ??= {
      idempotencyKey: crypto.randomUUID(),
      cardId: form.cardId,
      amountInCents: toAmountInCents(form.amount),
    };
    const attempt = lastAttempt.current;
    setSubmitting(true);
    setSubmitError('');
    try {
      await chargeBillingNioInvoiceCard(oystehrZambda, {
        invoiceId: invoice.id,
        amountInCents: attempt.amountInCents,
        paymentMethodId: attempt.cardId,
        idempotencyKey: attempt.idempotencyKey,
      });
    } catch (err) {
      setSubmitError(
        getApiError({
          error: err,
          defaultError: 'Failed to charge the card',
        })
      );
      const refused = isRefusedCharge(err);
      if (refused) lastAttempt.current = null;
      setRetryOnly(!refused);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onClose();
    await onPaid();
  };

  const closeIfIdle = (): void => {
    if (!submitting) onClose();
  };

  const savedCards = cards.data?.cards ?? [];

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
          Collect card payment
        </Typography>
        <IconButton size="small" onClick={closeIfIdle} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
            mt: 1,
          }}
        >
          {submitError && <Alert severity="error">{submitError}</Alert>}
          <PaymentAmountField
            control={control}
            name="amount"
            minInCents={STRIPE_MINIMUM_CHARGE_IN_CENTS}
            maxInCents={Math.round(openedBalance * 100)}
            disabled={retryOnly}
          />
          <CardSelect
            control={control}
            name="cardId"
            cards={savedCards}
            loading={cards.isPending}
            disabled={retryOnly}
            error={
              cards.isError
                ? getApiError({
                    error: cards.error,
                    defaultError: 'Failed to load saved cards',
                  })
                : ''
            }
            emptyMessage="This payer has no saved cards. Add one to charge it."
          />
          {addingCard ? (
            <AddCardSection invoiceId={invoice.id} onAdded={addCard} />
          ) : (
            <Box>
              <Button size="small" onClick={() => setAddingCard(true)} disabled={submitting || retryOnly}>
                Add card
              </Button>
            </Box>
          )}
        </Box>
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
          startIcon={submitting ? <CircularProgress size={14} /> : <CreditCardIcon fontSize="small" />}
          onClick={handleSubmit(submit)}
          disabled={submitting || !cardId || addingCard}
        >
          {retryOnly ? 'Try again' : 'Charge card'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
