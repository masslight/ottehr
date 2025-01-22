import LoadingButton from '@mui/lab/LoadingButton';
import { Box, Card, FormControlLabel, Radio, RadioGroup, Skeleton, Typography, useTheme } from '@mui/material';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { DateTime } from 'luxon';
import { FC, MouseEvent, SyntheticEvent, useMemo, useState } from 'react';
import { useQueryClient } from 'react-query';
import { CreditCardInfo } from 'utils';
import {
  useDeletePaymentMethod,
  useGetPaymentMethods,
  useSetDefaultPaymentMethod,
  useSetupPaymentMethod,
} from '../../../telemed/features/paperwork/paperwork.queries';
import { otherColors } from '../../../IntakeThemeProvider';

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
  const [selectedOption, setSelectedOption] = useState<string | undefined>();

  console.log('validCreditCardOnFile', validCreditCardOnFile);

  const handleCardToSelect = (cards: CreditCardInfo[]): void => {
    const defaultCard = cards.find((card) => card.default);
    const defaultCardExpired = expiredCardIds.find((cardId) => cardId === defaultCard?.id);
    if (defaultCard && !defaultCardExpired) {
      selectPaymentMethod(defaultCard.id);
      return;
    }
    const potentialFirstValidCard: CreditCardInfo | undefined = cards.filter(
      (card) => !expiredCardIds.includes(card.id)
    )[0];
    selectPaymentMethod(potentialFirstValidCard?.id || ADD_NEW_CARD_OPTION_VALUE);
  };

  const { isFetching: isCardsLoading, refetch: refetchPaymentMethods } = useGetPaymentMethods((data) => {
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

    setCards(data.cards);
  });
  const { data: setupData, isFetching: isSetupDataLoading } = useSetupPaymentMethod(() => {
    void refetchPaymentMethods();
  });

  const { mutate: deleteMethod, isLoading: isDeleteLoading } = useDeletePaymentMethod();
  const { mutate: setDefault, isLoading: isSetDefaultLoading } = useSetDefaultPaymentMethod();

  const theme = useTheme();

  const [isAddLoading, setIsAddLoading] = useState(false);
  const disabled = isAddLoading || isCardsLoading || isDeleteLoading || isSetDefaultLoading || isSetupDataLoading;

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

  const onDelete = (id: string): void => {
    deleteMethod(
      { paymentMethodId: id },
      {
        onSuccess: (): void => {
          const newCards = cards.filter((card) => card.id !== id);
          setCards(newCards);
          setExpiredCardIds(expiredCardIds.filter((expiredId) => expiredId !== id));
          if (newCards.length > 0) {
            handleCardToSelect(newCards);
          } else {
            selectPaymentMethod(ADD_NEW_CARD_OPTION_VALUE);
          }
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
            display: 'none', // just hiding this until able to add cards
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

                  {item.id === selectedOption && (
                    <LoadingButton
                      loading={isDeleteLoading}
                      disabled={disabled}
                      onClick={() => onDelete(item.id)}
                      variant="outlined"
                      color="error"
                      sx={{ alignSelf: 'start' }}
                    >
                      Delete Card
                    </LoadingButton>
                  )}
                </Box>
              );
            })
          )}

          {!isCardsLoading && (
            <FormControlLabel
              value={ADD_NEW_CARD_OPTION_VALUE}
              disabled={disabled}
              control={<Radio />}
              label="Add new card"
              sx={{
                border: '1px solid',
                borderRadius: 2,
                backgroundColor: () => {
                  if (ADD_NEW_CARD_OPTION_VALUE === selectedOption) {
                    return otherColors.lightBlue;
                  } else {
                    return theme.palette.background.paper;
                  }
                },
                borderColor: ADD_NEW_CARD_OPTION_VALUE === selectedOption ? 'primary.main' : otherColors.borderGray,
                paddingTop: 0,
                paddingBottom: 0,
                paddingRight: 2,
                marginX: 0,
                minHeight: 46,
              }}
            />
          )}
        </RadioGroup>
      </Box>

      {setupData?.clientSecret && selectedOption === ADD_NEW_CARD_OPTION_VALUE && (
        <Elements stripe={stripePromise} options={{ clientSecret: setupData.clientSecret }}>
          <CreditCardForm
            clientSecret={setupData.clientSecret}
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
    const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, { payment_method: { card } });
    if (!error) {
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
        display: 'none', // 'flex' just hiding this for now until able to add some cards,
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
