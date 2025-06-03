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
      throw new Error('Stripe ro stripe elements not provided');
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
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        alignItems: 'end',
      }}
    >
      <Box sx={{ width: '100%' }}>
        <CardElement
          options={{
            disabled: disabled || Boolean(condition && !conditionAccepted),
            disableLink: true,
            hidePostalCode: true,
          }}
        />
      </Box>

      <LoadingButton
        loading={isLoading}
        disabled={disabled || Boolean(condition && !conditionAccepted)}
        variant="outlined"
        type="submit"
        onClick={handleSubmit}
      >
        Add card
      </LoadingButton>
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
    </Box>
  );
};
