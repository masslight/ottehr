import {
  Alert,
  Box,
  Card,
  CircularProgress,
  FormControlLabel,
  Radio,
  RadioGroup,
  Snackbar,
  Typography,
  useTheme,
} from '@mui/material';
import { Elements } from '@stripe/react-stripe-js';
import { Stripe } from '@stripe/stripe-js';
import { FC, useEffect, useMemo, useState } from 'react';
import { AddCreditCardForm, loadStripe } from 'ui-components';
import { CreditCardInfo, PaymentMethodSetupZambdaOutput } from 'utils';
import { BoldPurpleInputLabel } from '../../../components/form';
import { dataTestIds } from '../../../helpers/data-test-ids';
import { otherColors } from '../../../IntakeThemeProvider';
import { useSetDefaultPaymentMethod } from '../../../telemed/features/paperwork/paperwork.queries';
import { usePaperworkContext } from '../context';
import { useCreditCardContext } from '../hooks/useCreditCardContext';
import { useCreditCardStore } from '../stores/useCreditCardStore';

interface CreditCardVerificationProps {
  fieldId: string;
  onChange: (event: { target: { value: boolean } }) => void;
  required: boolean;
  value?: boolean;
}

export const CreditCardVerification: FC<CreditCardVerificationProps> = ({ fieldId, onChange, required, value }) => {
  const {
    patient,
    appointment,
    paymentMethods: cards,
    refetchPaymentMethods,
    refetchSetupData,
    stripeSetupData: setupData,
    paymentMethodStateInitializing,
    cardsAreLoading,
  } = usePaperworkContext();

  useCreditCardContext({ fieldId, onChange, required, value, hasSavedCards: cards.length > 0 });
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [pendingSelection, setPendingSelection] = useState<string | undefined>(undefined);
  const defaultCard = useMemo(() => cards.find((card) => card.default), [cards]);
  const [selectedOption, setSelectedOption] = useState<string | undefined>(defaultCard?.id);

  const stripePromise = useMemo(
    () => loadStripe(import.meta.env.VITE_APP_STRIPE_KEY, setupData?.stripeAccount),
    [setupData?.stripeAccount]
  );

  useEffect(() => {
    if (selectedOption !== defaultCard?.id) {
      setSelectedOption(defaultCard?.id);
    }
  }, [cards, defaultCard?.id, selectedOption]);

  const { mutateAsync: setDefaultAsync, isPending: isSetDefaultLoading } = useSetDefaultPaymentMethod(
    patient?.id,
    appointment?.id
  );

  useEffect(() => {
    if (!onChange) return;
    if (selectedOption !== undefined && value !== true) {
      onChange({ target: { value: true } });
    } else if (selectedOption === undefined && value === true) {
      onChange({ target: { value: false } });
    }
  }, [onChange, selectedOption, value]);

  const disabled = cardsAreLoading || isSetDefaultLoading || paymentMethodStateInitializing;

  const onMakePrimary = async (id: string): Promise<void> => {
    setPendingSelection(id);
    await setDefaultAsync({
      paymentMethodId: id,
      onSuccess: async () => {
        if (value !== true && onChange) {
          onChange({ target: { value: true } });
        }

        await Promise.all([refetchPaymentMethods(), refetchSetupData()]);
        setSelectedOption(id);
        setPendingSelection(undefined);
      },
      onError: (error) => {
        console.error('setDefault error', error);
        setPendingSelection(undefined);
        setErrorMessage('Unable to set default payment method. Please try again later or select a card.');
      },
    });
  };

  const handleNewPaymentMethod = async (id: string): Promise<void> => {
    await onMakePrimary(id);
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
          Please select your preferred payment method for any outstanding balance not covered by your insurance
          provider. If you are self-paying, the selected card will be charged for the total amount due.
        </Typography>
      </Card>
      <CreditCardContent
        setupData={setupData}
        pendingSelection={pendingSelection}
        selectedOption={selectedOption}
        cards={cards}
        disabled={disabled}
        required={required}
        errorMessage={errorMessage}
        stripePromise={stripePromise}
        setErrorMessage={setErrorMessage}
        onMakePrimary={onMakePrimary}
        handleNewPaymentMethod={handleNewPaymentMethod}
      />
    </Box>
  );
};

interface CreditCardContentProps {
  setupData: PaymentMethodSetupZambdaOutput | undefined;
  pendingSelection: string | undefined;
  selectedOption: string | undefined;
  cards: CreditCardInfo[];
  disabled: boolean;
  required: boolean;
  errorMessage: string | undefined;
  stripePromise: Promise<Stripe | null>;
  setErrorMessage: (message: string | undefined) => void;
  onMakePrimary: (id: string) => Promise<void>;
  handleNewPaymentMethod: (id: string) => Promise<void>;
}

const CreditCardContent: FC<CreditCardContentProps> = ({
  setupData,
  pendingSelection,
  cards,
  selectedOption,
  disabled,
  errorMessage,
  required,
  stripePromise,
  setErrorMessage,
  onMakePrimary,
  handleNewPaymentMethod,
}) => {
  const theme = useTheme();
  const cardFormRef = useCreditCardStore((state) => state.cardFormRef);
  const handleCardChange = useCreditCardStore((state) => state.handleCardChange);

  const stripeOptions = useMemo(
    () => ({
      clientSecret: setupData?.clientSecret,
    }),
    [setupData?.clientSecret]
  );

  return (
    <>
      <Box>
        <BoldPurpleInputLabel
          id="default-card-selection-label"
          htmlFor="default-card-selection-group"
          required={required}
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
          onChange={(e) => void onMakePrimary(e.target.value)}
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

      {!setupData?.clientSecret ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Elements stripe={stripePromise} options={stripeOptions} key={setupData.clientSecret}>
          <AddCreditCardForm
            ref={cardFormRef}
            clientSecret={setupData.clientSecret}
            disabled={disabled}
            selectPaymentMethod={handleNewPaymentMethod}
            onCardChange={handleCardChange}
          />
        </Elements>
      )}
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
