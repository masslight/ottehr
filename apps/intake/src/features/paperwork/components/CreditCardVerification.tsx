import LoadingButton from '@mui/lab/LoadingButton';
import {
  Alert,
  Box,
  Card,
  CircularProgress,
  FormControlLabel,
  Radio,
  RadioGroup,
  Skeleton,
  Snackbar,
  Typography,
  useTheme,
} from '@mui/material';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { FC, MouseEvent, useState } from 'react';
import { CreditCardInfo } from 'utils';
import {
  useGetPaymentMethods,
  useSetDefaultPaymentMethod,
  useSetupPaymentMethod,
} from '../../../telemed/features/paperwork/paperwork.queries';
import { otherColors } from '../../../IntakeThemeProvider';
import { BoldPurpleInputLabel, usePaperworkContext } from 'ui-components';
import { dataTestIds } from '../../../helpers/data-test-ids';

const stripePromise = loadStripe(import.meta.env.VITE_APP_STRIPE_KEY);

interface CreditCardVerificationProps {
  onChange: (event: { target: { value: boolean } }) => void;
  value?: boolean;
}

export const CreditCardVerification: FC<CreditCardVerificationProps> = ({ value: validCreditCardOnFile, onChange }) => {
  const [cards, setCards] = useState<CreditCardInfo[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | undefined>(cards.find((card) => card.default)?.id);
  const { patient } = usePaperworkContext();
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  const [pendingSelection, setPendingSelection] = useState<string | undefined>(undefined);

  const { data: setupData, isFetching: isSetupDataLoading } = useSetupPaymentMethod(patient?.id);

  const { isFetching: isCardsLoading, refetch: refetchPaymentMethods } = useGetPaymentMethods({
    beneficiaryPatientId: patient?.id,
    setupCompleted: Boolean(setupData),
    onSuccess: (data) => {
      setCards(data.cards);
      const defaultCard = data.cards.find((card) => card.default);
      setSelectedOption(defaultCard?.id);
      if (defaultCard?.id !== undefined) {
        onChange({ target: { value: true } });
      } else {
        onChange({ target: { value: false } });
      }
    },
  });

  const { mutate: setDefault, isLoading: isSetDefaultLoading } = useSetDefaultPaymentMethod(patient?.id);

  const disabled = isCardsLoading || isSetDefaultLoading || isSetupDataLoading;

  const onMakePrimary = (id: string, refreshOnSuccess?: boolean): void => {
    setPendingSelection(id);
    setDefault({
      paymentMethodId: id,
      onSuccess: async () => {
        if (refreshOnSuccess) {
          await refetchPaymentMethods();
        }
        setSelectedOption(id);
        setPendingSelection(undefined);
        if (validCreditCardOnFile !== true) {
          onChange({ target: { value: true } });
        }
      },
      onError: (error) => {
        console.error('setDefault error', error);
        setPendingSelection(undefined);
        setErrorMessage('Unable to set default payment method. Please try again later or select a card.');
      },
    });
  };

  const handleNewPaymentMethod = (id: string): void => {
    onMakePrimary(id, true);
  };

  const isInitialLoad = (setupData === undefined && isSetupDataLoading) || (cards.length === 0 && isCardsLoading);

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
          Please select your preferred payment method for any outstanding balance not covered by your insurance
          provider. If you are self-paying, the selected card will be charged for the total amount due.
        </Typography>
      </Card>
      {isInitialLoad ? (
        <Skeleton variant="rounded" height={250} />
      ) : (
        <CreditCardContent
          setupData={setupData}
          pendingSelection={pendingSelection}
          selectedOption={selectedOption}
          cards={cards}
          disabled={disabled}
          errorMessage={errorMessage}
          setErrorMessage={setErrorMessage}
          onMakePrimary={onMakePrimary}
          handleNewPaymentMethod={handleNewPaymentMethod}
        />
      )}
    </Box>
  );
};

interface CreditCardContentProps {
  setupData: string | undefined;
  pendingSelection: string | undefined;
  selectedOption: string | undefined;
  cards: CreditCardInfo[];
  disabled: boolean;
  errorMessage: string | undefined;
  setErrorMessage: (message: string | undefined) => void;
  onMakePrimary: (id: string, refreshOnSuccess?: boolean) => void;
  handleNewPaymentMethod: (id: string) => void;
}

const CreditCardContent: FC<CreditCardContentProps> = (props) => {
  const {
    setupData,
    pendingSelection,
    cards,
    selectedOption,
    disabled,
    errorMessage,
    setErrorMessage,
    onMakePrimary,
    handleNewPaymentMethod,
  } = props;
  const theme = useTheme();
  return (
    <>
      <Box>
        <BoldPurpleInputLabel
          id="default-card-selection-label"
          htmlFor="default-card-selection-group"
          required={true}
          sx={(theme) => ({
            whiteSpace: 'pre-wrap',
            position: 'unset',
            color: theme.palette.primary.dark,
          })}
        >
          {`${cards.length ? 'Select' : 'Add'} the card you want to pay with`}
        </BoldPurpleInputLabel>
        <RadioGroup
          name="default-card-selection-group"
          aria-label="Default card selection radio group"
          sx={{
            '.MuiFormControlLabel-label': {
              width: '100%',
            },
            gap: 1,
          }}
          value={selectedOption || ''}
          onChange={(e) => onMakePrimary(e.target.value)}
        >
          {cards.map((item) => {
            return (
              <Box key={item.id} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <FormControlLabel
                  value={item.id}
                  disabled={disabled}
                  control={
                    pendingSelection === item.id ? (
                      <CircularProgress sx={{ maxWidth: '22px', maxHeight: '22px', padding: '9px' }} />
                    ) : (
                      <Radio />
                    )
                  }
                  label={
                    <Box
                      sx={{
                        display: 'flex',
                        // flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Typography data-testid={dataTestIds.cardNumber}>XXXX - XXXX - XXXX - {item.lastFour}</Typography>
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
          })}
        </RadioGroup>
      </Box>

      <Elements stripe={stripePromise} options={{ clientSecret: setupData }}>
        <CreditCardForm
          clientSecret={setupData ?? ''}
          isLoading={disabled}
          disabled={disabled}
          selectPaymentMethod={handleNewPaymentMethod}
        />
      </Elements>
      <Snackbar
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        open={errorMessage !== undefined}
        autoHideDuration={5000}
        onClose={() => setErrorMessage(undefined)}
      >
        <Alert onClose={() => setErrorMessage(undefined)} severity="error" variant="filled">
          {errorMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

type CreditCardFormProps = {
  clientSecret: string;
  isLoading: boolean;
  disabled: boolean;
  selectPaymentMethod: (id: string) => void;
};

const CreditCardForm: FC<CreditCardFormProps> = (props) => {
  const { clientSecret, isLoading, disabled, selectPaymentMethod } = props;

  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (e: MouseEvent<HTMLButtonElement>): Promise<void> => {
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
