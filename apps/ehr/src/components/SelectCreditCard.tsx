/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Snackbar,
  Alert,
  Autocomplete,
  AutocompleteRenderInputParams,
  TextField,
  CircularProgress,
  FormHelperText,
} from '@mui/material';
import { Box } from '@mui/system';
import { FC, useState } from 'react';
import { CreditCardInfo } from 'utils';
import { Elements } from '@stripe/react-stripe-js';
import { AddCreditCardForm } from 'ui-components';
import { loadStripe } from '@stripe/stripe-js/dist';
import { useSetupStripe } from 'src/hooks/useSetupStripe';
import { useGetPaymentMethods } from 'src/hooks/useGetPaymentMethods';
import { Patient } from 'fhir/r4b';
import { useSetDefaultPaymentMethod } from 'src/hooks/useSetDefaultPaymentMethod';

interface CreditCardContentProps {
  patient: Patient;
  selectedCardId: string;
  handleCardSelected: (newVal: string | undefined) => void;
  error?: string;
}

const stripePromise = loadStripe(import.meta.env.VITE_APP_STRIPE_KEY);

const labelForCard = (card: CreditCardInfo): string => {
  return `XXXX - XXXX - XXXX - ${card.lastFour}${card.default ? ' (Primary)' : ''}`;
};

const NEW_CARD = { id: 'new', label: 'Add new card' };

const CreditCardContent: FC<CreditCardContentProps> = (props) => {
  const { patient, selectedCardId, handleCardSelected, error } = props;
  const [cards, setCards] = useState<CreditCardInfo[]>([]);

  const [addingNewCard, setAddingNewCard] = useState<boolean>(false);

  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  const {
    data: setupData,
    isFetching: isSetupDataFetching,
    isLoading: isSetupDataLoading,
  } = useSetupStripe(patient?.id);

  const { mutate: setDefault } = useSetDefaultPaymentMethod(patient?.id);

  const { isFetching: cardsAreLoading, refetch: refetchPaymentMethods } = useGetPaymentMethods({
    beneficiaryPatientId: patient?.id,
    setupCompleted: Boolean(setupData),
    onSuccess: (data) => {
      console.group('card data', data);
      setCards(data.cards ?? []);
      const defaultCard = data.cards.find((card) => card.default);
      if (defaultCard && !selectedCardId) {
        handleCardSelected(defaultCard.id);
      }
      if (data.cards.length === 0) {
        setAddingNewCard(true);
      }
    },
  });

  const initializing = isSetupDataFetching || isSetupDataLoading;

  const cardOptions = [
    ...cards.map((card) => ({ id: card.id, label: labelForCard(card) })),
    { id: 'new', label: 'Add new card' },
  ];

  const selectedCard = cardOptions.find((card) => card.id === selectedCardId);
  const someDefault = cards.some((card) => card.default);

  const handleNewPaymentMethod = async (id: string, makeDefault: boolean): Promise<void> => {
    if (makeDefault) {
      setDefault({
        paymentMethodId: id,
        onSuccess: async () => {
          await refetchPaymentMethods();
        },
        onError: (error) => {
          console.error('setDefault error', error);
          setErrorMessage('Unable to set default payment method. Please try again later or select a card.');
        },
      });
    } else {
      await refetchPaymentMethods();
    }
    handleCardSelected(id);
    setAddingNewCard(false);
  };

  console.log('initializing', initializing);
  console.log('cards', cards);
  console.log('cardsAreLoading', cardsAreLoading);

  if (initializing) {
    return (
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }
  const currentValue = addingNewCard ? NEW_CARD : selectedCard ?? null;
  const showCardList = cards.length > 0;
  console.log('currentValue', currentValue);
  return (
    <>
      <Autocomplete
        size="small"
        aria-label="Default card selection radio group"
        fullWidth
        sx={{
          '.MuiFormControlLabel-label': {
            width: '100%',
          },
          gap: 1,
          display: showCardList ? 'initial' : 'none',
          marginBottom: 2,
        }}
        options={cardOptions}
        renderOption={(props, option) => (
          <li {...props} key={option.id}>
            {option.label}
          </li>
        )}
        value={currentValue}
        renderInput={(params: AutocompleteRenderInputParams) => {
          return (
            <Box>
              <TextField
                {...params}
                fullWidth
                required
                label="Credit card"
                variant="outlined"
                error={Boolean(error)}
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  ...params.inputProps,
                  autoComplete: 'off',
                }}
              />
              {error && <FormHelperText error={Boolean(error)}>{error}</FormHelperText>}
            </Box>
          );
        }}
        onChange={(_event, value) => {
          if (value?.id === NEW_CARD.id) {
            setAddingNewCard(true);
            console.log('Adding new card set');
          }
          handleCardSelected(value?.id);
          if (addingNewCard) {
            setAddingNewCard(false);
          }
        }}
      />

      <Elements stripe={stripePromise} options={{ clientSecret: setupData }}>
        <Box
          sx={{
            width: '100%',
            display: addingNewCard ? 'flex' : 'none',
            justifyContent: 'center',
            alignItems: 'flex-start',
            flexDirection: 'column',
            marginTop: 2,
          }}
        >
          <AddCreditCardForm
            clientSecret={setupData ?? ''}
            isLoading={false}
            disabled={false}
            selectPaymentMethod={(id) => {
              void handleNewPaymentMethod(id, !someDefault);
            }}
            condition="I have obtained the consent to add a card on file from the patient"
          />
        </Box>
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

export default CreditCardContent;
