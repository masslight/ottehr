import LoadingButton from '@mui/lab/LoadingButton';
import { Box, Card, FormControlLabel, Radio, RadioGroup, Skeleton, Typography, useTheme } from '@mui/material';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { DateTime } from 'luxon';
import { FC, MouseEvent, SyntheticEvent, useMemo, useState } from 'react';
import { useQueryClient } from 'react-query';
import { CreditCardInfo } from 'utils';
import {
  useGetPaymentMethods,
  useSetDefaultPaymentMethod,
  useSetupPaymentMethod,
} from '../../../telemed/features/paperwork/paperwork.queries';
import { otherColors } from '../../../IntakeThemeProvider';
import { usePaperworkContext } from 'ui-components';

const ADD_NEW_CARD_OPTION_VALUE = 'add-new-card';
const stripePromise = loadStripe(import.meta.env.VITE_APP_STRIPE_KEY);

interface CreditCardVerificationProps {
  value?: boolean;
  onChange: (event: SyntheticEvent) => void;
}

export const CreditCardVerification: FC<CreditCardVerificationProps> = ({ value: validCreditCardOnFile }) => {
  const [cards, setCards] = useState<CreditCardInfo[]>([]);
  const [expiredCardIds, setExpiredCardIds] = useState<string[]>([]);
  const defaultCard = useMemo(() => cards.find((card) => card.default), [cards]);
  const otherCards = useMemo(() => cards.filter((card) => !card.default), [cards]);
  const [selectedOption, setSelectedOption] = useState<string | undefined>(defaultCard?.id);
  const { patient } = usePaperworkContext();

  console.log('validCreditCardOnFile', validCreditCardOnFile);

  const { data: setupData, isFetching: isSetupDataLoading } = useSetupPaymentMethod(patient?.id, () => {
    // void refetchPaymentMethods();
  });

  const { isFetching: isCardsLoading } = useGetPaymentMethods(setupData ? patient?.id : undefined, (data) => {
    const expiredCards = data.cards.filter((card) => {
      const { expMonth, expYear } = card;
      const today = DateTime.now();

      if (today.year > expYear) return true;
      if (today.year === expYear && today.month > expMonth) return true;
      // Expiring soon should be treated as expired
      if (today.year === expYear && today.month === expMonth && today.daysInMonth - today.day < 3) return true;
      return false;
    });
    setExpiredCardIds(expiredCards.map((card) => card.id));

    console.log('cards', data.cards);

    setCards(data.cards);
    const defaultCard = data.cards.find((card) => card.default);
    setSelectedOption(defaultCard?.id);
    console.log('defaultCard', defaultCard);
  });

  console.log('selectedOption', selectedOption);

  const { mutate: setDefault, isLoading: isSetDefaultLoading } = useSetDefaultPaymentMethod(patient?.id);

  const theme = useTheme();

  const [isAddLoading, setIsAddLoading] = useState(false);
  const disabled = isAddLoading || isCardsLoading || isSetDefaultLoading || isSetupDataLoading;
  console.log('disabled', disabled);

  const onMakePrimary = (id: string): void => {
    setDefault(
      { paymentMethodId: id },
      {
        onSuccess: (): void => {
          setCards((prevState) => prevState.map((card) => ({ ...card, default: card.id === id })));
        },
      }
    );
  };

  const selectPaymentMethod = (id: string): void => {
    // setSelected(id);
    setSelectedOption(id);
    if (id !== ADD_NEW_CARD_OPTION_VALUE) {
      onMakePrimary(id);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      <Card sx={{ p: 2, backgroundColor: otherColors.coachingVisit, borderRadius: 2 }} elevation={0}>
        <Typography color="primary.main">
          By choosing to proceed with self-pay without insurance, you agree to pay $100 at the time of service.
        </Typography>
      </Card>
      <Box>
        <RadioGroup
          sx={{
            '.MuiFormControlLabel-label': {
              width: '100%',
            },
            gap: 1,
          }}
          value={selectedOption || ''}
          onChange={(e) => selectPaymentMethod(e.target.value)}
        >
          {isCardsLoading ? (
            <>
              <Skeleton variant="rounded" height={48} />
            </>
          ) : (
            (defaultCard ? [defaultCard, ...otherCards] : otherCards).map((item) => {
              const isThisCardExpired = !!expiredCardIds.find((id) => id === item.id);
              return (
                <Box key={item.id} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <FormControlLabel
                    value={item.id}
                    disabled={disabled}
                    control={<Radio />}
                    label={
                      <Box
                        sx={{
                          display: 'flex',
                          // flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Typography>XXXX-XXXX-XXXX-{item.lastFour}</Typography>
                        {isThisCardExpired && <Typography>Expired</Typography>}
                      </Box>
                    }
                    sx={{
                      border: '1px solid',
                      borderRadius: 2,
                      backgroundColor: () => {
                        if (item.id === selectedOption) {
                          return otherColors.lightBlue;
                        } else {
                          return theme.palette.background.paper;
                        }
                      },
                      borderColor: item.id === selectedOption ? 'primary.main' : otherColors.borderGray,
                      paddingTop: 0,
                      paddingBottom: 0,
                      paddingRight: 2,
                      marginX: 0,
                      minHeight: 46,
                    }}
                  />
                </Box>
              );
            })
          )}
        </RadioGroup>
      </Box>

      {setupData && !isCardsLoading && (
        <Elements stripe={stripePromise} options={{ clientSecret: setupData }}>
          <CreditCardForm
            clientSecret={setupData}
            isLoading={isAddLoading}
            disabled={disabled}
            setIsLoading={setIsAddLoading}
            selectPaymentMethod={selectPaymentMethod}
          />
        </Elements>
      )}
    </Box>
  );
};

type CreditCardFormProps = {
  clientSecret: string;
  isLoading: boolean;
  disabled: boolean;
  setIsLoading: (value: boolean) => void;
  selectPaymentMethod: (id: string) => void;
};

const CreditCardForm: FC<CreditCardFormProps> = (props) => {
  const { clientSecret, isLoading, disabled, setIsLoading, selectPaymentMethod } = props;

  const stripe = useStripe();
  const elements = useElements();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: MouseEvent<HTMLButtonElement>): Promise<void> => {
    e.preventDefault();

    if (!stripe || !elements) {
      throw new Error('Stripe ro stripe elements not provided');
    }

    const card = elements.getElement(CardElement);
    if (!card) {
      throw new Error('Stripe card element not found');
    }

    setIsLoading(true);
    console.log('clientSecret', clientSecret);
    console.log('card', card);
    const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, { payment_method: { card } });
    if (!error) {
      console.log('setupIntent', setupIntent);
      const invalidateSetup = queryClient.invalidateQueries({ queryKey: ['setup-payment-method'] });
      const invalidateMethods = queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      await invalidateSetup;
      await invalidateMethods;

      if (typeof setupIntent.payment_method === 'string') {
        selectPaymentMethod(setupIntent.payment_method);
      }

      card.clear();
    }
    setIsLoading(false);
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
            disableLink: true,
            hidePostalCode: true,
          }}
        />
      </Box>

      <LoadingButton loading={isLoading} disabled={disabled} variant="outlined" type="submit" onClick={handleSubmit}>
        Add card
      </LoadingButton>
    </Box>
  );
};
