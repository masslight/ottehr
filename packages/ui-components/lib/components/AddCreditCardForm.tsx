import { LoadingButton } from '@mui/lab';
import { Checkbox, CircularProgress, FormLabel } from '@mui/material';
import { Box } from '@mui/system';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

type CreditCardFormProps = {
  clientSecret: string;
  disabled: boolean;
  condition?: string;
  hidesLabel?: boolean;
  selectPaymentMethod: (id: string) => void | Promise<void>;
  onCardChange?: () => void;
  showAddButton?: boolean; // button is used in the EHR, Intake automatically saves the card on continue button click
};

export interface AddCreditCardFormHandle {
  getCardState: () => { complete: boolean; error?: { message: string } };
  saveCard: () => Promise<{ success: boolean; error?: string }>;
}

// this component must be the child of an Elements component from the stripe library
export const AddCreditCardForm = forwardRef<AddCreditCardFormHandle, CreditCardFormProps>((props, ref) => {
  const { clientSecret, disabled, condition, selectPaymentMethod, onCardChange, showAddButton = false } = props;

  const stripe = useStripe();
  const elements = useElements();
  const [conditionAccepted, setConditionAccepted] = useState<boolean>(false);

  const [cardState, setCardState] = useState<{
    complete: boolean;
    error?: { message: string };
  }>({ complete: false });

  const [isSaving, setIsSaving] = useState<boolean>(false);

  // EHR app uses this state for error messages; Intake app uses a modal instead
  const [saveError, setSaveError] = useState<string | undefined>(undefined);

  const hasSavedRef = useRef<boolean>(false);

  const saveCard = async (): Promise<{ success: boolean; error?: string }> => {
    if (!stripe || !elements) {
      return { success: false, error: 'Stripe or stripe elements not provided' };
    }

    if (hasSavedRef.current) {
      return { success: true };
    }

    if (isSaving) {
      return { success: false, error: 'Card save already in progress' };
    }

    const card = elements.getElement(CardElement);

    if (!card) {
      return { success: false, error: 'Stripe card element not found' };
    }

    setIsSaving(true);
    hasSavedRef.current = true;

    try {
      const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, { payment_method: { card } });

      if (error) {
        console.error('[AddCreditCardForm] Stripe error:', error);
        hasSavedRef.current = false;
        setSaveError(error.message);
        return { success: false, error: error.message };
      }

      card.clear();

      if (typeof setupIntent.payment_method === 'string') {
        await selectPaymentMethod(setupIntent.payment_method);
      }

      setSaveError(undefined);
      return { success: true };
    } catch (err) {
      console.error('[AddCreditCardForm] Unexpected error during card save:', err);
      hasSavedRef.current = false;
      const errorMessage = 'Failed to save card data';
      setSaveError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSaving(false);
    }
  };

  useImperativeHandle(ref, () => ({
    getCardState: () => cardState,
    saveCard,
  }));

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        alignItems: 'end',
        backgroundColor: 'rgba(244, 246, 248, 1)',
        borderRadius: 1,
        padding: 2,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <Box
        sx={{
          width: '100%',
          backgroundColor: 'white',
          border: '1px solid rgba(0, 0, 0, 0.23)',
          padding: '10px 12px',
          borderRadius: 1,
          boxSizing: 'border-box',
        }}
      >
        <CardElement
          onChange={(e) => {
            setCardState({
              complete: e.complete,
              error: e.error,
            });
            setSaveError(undefined);
            onCardChange?.();
            if (!e.complete) {
              hasSavedRef.current = false;
            }
          }}
          options={{
            disabled: disabled || isSaving,
            disableLink: true,
            hidePostalCode: true,
            style: {
              base: {
                fontSize: '16px',
                color: '#32325d',
                fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
                '::placeholder': {
                  color: '#aab7c4',
                },
                lineHeight: '24px',
                padding: '20px 12px',
              },
              invalid: {
                color: '#fa755a',
                iconColor: '#fa755a',
              },
            },
          }}
        />
      </Box>
      {showAddButton && saveError && (
        <Box sx={{ width: '100%' }}>
          <FormLabel error sx={{ marginLeft: '12px', color: '#d32f2f', fontSize: '0.95rem' }}>
            {saveError}
          </FormLabel>
        </Box>
      )}
      {condition && (
        <Box sx={{ display: 'flex', minWidth: '100%', alignItems: 'center', gap: 1 }}>
          <Checkbox
            id="condition-acceptance"
            checked={conditionAccepted}
            onChange={(e) => setConditionAccepted(e.target.checked)}
            disabled={isSaving}
          />
          <FormLabel htmlFor="condition-acceptance">{condition}</FormLabel>
        </Box>
      )}
      {showAddButton && (
        <LoadingButton
          loading={isSaving}
          disabled={disabled || !cardState.complete || Boolean(condition && !conditionAccepted)}
          variant="outlined"
          type="button"
          onClick={() => void saveCard()}
        >
          Add card
        </LoadingButton>
      )}
      {isSaving && !showAddButton && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={20} />
          <FormLabel>Saving card...</FormLabel>
        </Box>
      )}
    </Box>
  );
});
