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
import {
  CreditCardInfo,
  findQuestionnaireResponseItemLinkId,
  IntakeQuestionnaireItem,
  pickFirstValueFromAnswerItem,
} from 'utils';
import { BoldPurpleInputLabel } from '../../../components/form';
import { dataTestIds } from '../../../helpers/data-test-ids';
import { otherColors } from '../../../IntakeThemeProvider';
import { useSetDefaultPaymentMethod } from '../../../telemed/features/paperwork/paperwork.queries';
import { usePaperworkContext } from '../context';

interface CreditCardVerificationProps {
  onChange: (event: { target: { value: boolean } }) => void;
  required: boolean;
  value?: boolean;
  pageItem?: IntakeQuestionnaireItem;
}

export const CreditCardVerification: FC<CreditCardVerificationProps> = ({
  value: validCreditCardOnFile,
  required,
  onChange,
  pageItem,
}) => {
  const {
    patient,
    paymentMethods: cards,
    refetchPaymentMethods,
    stripeSetupData: setupData,
    paymentMethodStateInitializing,
    cardsAreLoading,
    paperwork,
  } = usePaperworkContext();
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  const [pendingSelection, setPendingSelection] = useState<string | undefined>(undefined);

  const defaultCard = useMemo(() => cards.find((card) => card.default), [cards]);
  const [selectedOption, setSelectedOption] = useState<string | undefined>(defaultCard?.id);

  let stripePublicKey: string = import.meta.env.VITE_APP_STRIPE_KEY;

  const stripeAccountIdFromPaperwork = findQuestionnaireResponseItemLinkId('stripe-account-id', paperwork);
  if (stripeAccountIdFromPaperwork) {
    const stripeAccountId = pickFirstValueFromAnswerItem(stripeAccountIdFromPaperwork, 'string');
    if (stripeAccountId) {
      const stripePublicKeyForAccountId = import.meta.env[`VITE_APP_STRIPE_KEY_FOR_ACCOUNT_ID_${stripeAccountId}`];
      if (stripePublicKeyForAccountId) {
        stripePublicKey = stripePublicKeyForAccountId;
      } else {
        console.error(`No Stripe public key found for account ID: ${stripeAccountId}`);
        throw new Error(`No Stripe public key found for account ID: ${stripeAccountId}`);
      }
    } else {
      console.error('stripe-account-id was in paperwork but did not have a value');
      throw new Error('stripe-account-id was in paperwork but did not have a value');
    }
  }

  const stripePromise = loadStripe(stripePublicKey);

  useEffect(() => {
    if (selectedOption !== defaultCard?.id) {
      setSelectedOption(defaultCard?.id);
    }
  }, [cards, defaultCard?.id, selectedOption]);

  const { mutate: setDefault, isPending: isSetDefaultLoading } = useSetDefaultPaymentMethod(patient?.id);

  useEffect(() => {
    if (selectedOption !== undefined && validCreditCardOnFile !== true) {
      onChange({ target: { value: true } });
    } else if (selectedOption === undefined && validCreditCardOnFile === true) {
      onChange({ target: { value: false } });
    }
  }, [onChange, selectedOption, validCreditCardOnFile]);

  const disabled = cardsAreLoading || isSetDefaultLoading || paymentMethodStateInitializing;

  const onMakePrimary = (id: string): void => {
    setPendingSelection(id);
    setDefault({
      paymentMethodId: id,
      onSuccess: async () => {
        await refetchPaymentMethods();
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
    onMakePrimary(id);
  };

  const detailsText = pageItem?.item?.find((item) => item.linkId === 'card-payment-details-text')?.text;

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
      {detailsText ? <Typography variant="body2">{detailsText}</Typography> : null}
      <CreditCardContent
        setupData={setupData as any}
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
  setupData: string | undefined;
  pendingSelection: string | undefined;
  selectedOption: string | undefined;
  cards: CreditCardInfo[];
  disabled: boolean;
  required: boolean;
  errorMessage: string | undefined;
  stripePromise: Promise<Stripe | null>;
  setErrorMessage: (message: string | undefined) => void;
  onMakePrimary: (id: string) => void;
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
    required,
    stripePromise,
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
        <AddCreditCardForm
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
