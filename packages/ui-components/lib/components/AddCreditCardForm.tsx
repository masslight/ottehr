import { LoadingButton } from '@mui/lab';
import { Box } from '@mui/system';
import { FC, useState } from 'react';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Checkbox, FormLabel } from '@mui/material';

type CreditCardFormProps = {
  clientSecret: string;
  isLoading: boolean;
  disabled: boolean;
  condition?: string;
  hidesLabel?: boolean;
  selectPaymentMethod: (id: string) => void;
};
// this component must be the child of an Elements component from the stripe library
export const AddCreditCardForm: FC<CreditCardFormProps> = (props) => {
  const { clientSecret, isLoading, disabled, condition, selectPaymentMethod } = props;

  const stripe = useStripe();
  const elements = useElements();
  const [conditionAccepted, setConditionAccepted] = useState<boolean>(false);

  const handleSubmit = async (e: any): Promise<void> => {
    e.preventDefault();

    if (!stripe || !elements) {
      throw new Error('Stripe or stripe elements not provided');
    }

    const card = elements.getElement(CardElement);
    if (!card) {
      throw new Error('Stripe card element not found');
    }

    const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, { payment_method: { card } });
    if (!error) {
      if (typeof setupIntent.payment_method === 'string') {
        selectPaymentMethod(setupIntent.payment_method);
      }
      card.clear();
      e.clear();
    } else {
      console.error('Error confirming card setup:', error);
      if (error.message) {
        alert(error.message);
      }
    }
  };

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
      }}
    >
      <Box
        sx={{
          width: '100%',
          backgroundColor: 'white',
          border: '1px solid rgba(0, 0, 0, 0.23)',
          padding: '10px 12px',
          borderRadius: 1,
        }}
      >
        <CardElement
          options={{
            disabled: disabled,
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
      {condition && (
        <Box sx={{ display: 'flex', minWidth: '100%', alignItems: 'center', gap: 1 }}>
          <Checkbox
            id="condition-acceptance"
            checked={conditionAccepted}
            onChange={(e) => setConditionAccepted(e.target.checked)}
          />
          <FormLabel htmlFor="condition-acceptance">{condition}</FormLabel>
        </Box>
      )}
      <LoadingButton
        loading={isLoading}
        disabled={disabled || Boolean(condition && !conditionAccepted)}
        variant="outlined"
        type="submit"
        onClick={handleSubmit}
      >
        Add card
      </LoadingButton>
    </Box>
  );
};
