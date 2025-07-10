import { yupResolver } from '@hookform/resolvers/yup';
import LoadingButton from '@mui/lab/LoadingButton';
import {
  Box,
  Button,
  capitalize,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputLabel,
  OutlinedInput,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ReactElement, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  CashOrCardPayment,
  DOB_DATE_FORMAT,
  formatPhoneNumberDisplay,
  getFirstName,
  getLastName,
  getMiddleName,
  getPhoneNumberForIndividual,
  sleep,
} from 'utils';
import * as yup from 'yup';
import { dataTestIds } from '../../constants/data-test-ids';
import SelectCreditCard from '../SelectCreditCard';

interface PaymentDialogProps {
  handleClose: () => void;
  submitPayment: (data: CashOrCardPayment) => Promise<void>;
  isSubmitting: boolean;
  open: boolean;
  patient: Patient;
}

const PatientHeader = (props: { patient: Patient }): ReactElement => {
  const { patient } = props;
  const patientFirstName = getFirstName(patient);
  const patientLastName = getLastName(patient);
  const middleName = getMiddleName(patient);
  const nameElements = [patientLastName, middleName, patientFirstName].filter(Boolean);
  const patientDOB = patient.birthDate ? DateTime.fromISO(patient.birthDate).toFormat(DOB_DATE_FORMAT) : 'Unknown';
  const dobString = `DOB: ${patientDOB}`;
  const genderString = capitalize(patient.gender ?? '');
  const phoneNumber = formatPhoneNumberDisplay(getPhoneNumberForIndividual(patient) ?? '');

  return (
    <Grid container direction="column" sx={{ marginBottom: 2 }} spacing={0.5}>
      <Grid item xs={12}>
        <Typography variant="body1" color="rgba(0, 0, 0, 0.87)" fontWeight={500}>
          {`${nameElements.join(', ')}`}
        </Typography>
      </Grid>
      <Grid container item direction="row" spacing={2}>
        <Grid item>
          <Typography variant="body2" color="rgba(0, 0, 0, 0.87)">
            {dobString}
          </Typography>
        </Grid>
        <Grid item>
          <Typography variant="body2" color="rgba(0, 0, 0, 0.87)">
            {genderString}
          </Typography>
        </Grid>
        <Grid item>
          <Typography variant="body2" color="rgba(0, 0, 0, 0.87)">
            {phoneNumber}
          </Typography>
        </Grid>
      </Grid>
    </Grid>
  );
};

const paymentSchema = yup.object().shape({
  amount: yup
    .number()
    .typeError('Amount must be a number')
    .required('Amount is required')
    .positive('Amount must be greater than 0'),
  paymentMethod: yup
    .string()
    .oneOf(['card', 'cash', 'check'], 'Invalid payment method')
    .required('Payment method is required'),
  creditCard: yup.string().when('paymentMethod', {
    is: (val: string) => val === 'card',
    then: (schema) =>
      schema
        .required('Credit card selection required')
        .matches(RegExp('pm_[a-zA-Z0-9]{24,24}'), 'Credit card selection required')
        .required(),
    otherwise: (schema) => schema.notRequired().nullable(),
  }),
});

export default function ({
  submitPayment,
  handleClose,
  open,
  patient,
  isSubmitting,
}: PaymentDialogProps): ReactElement {
  const buttonSx = {
    fontWeight: 500,
    textTransform: 'none',
    borderRadius: 6,
  };

  const { handleSubmit, register, watch, formState, control, setValue, reset } = useForm({
    defaultValues: {
      amount: '',
      paymentMethod: 'card',
      creditCard: '',
    },
    resolver: yupResolver(paymentSchema),
    mode: 'onBlur',
  });

  useEffect(() => {
    const resetFormAfterDelay = async (): Promise<void> => {
      await sleep(250);
      reset();
    };
    if (!open) {
      void resetFormAfterDelay();
    }
  }, [open, reset]);

  const paymentMethod = watch('paymentMethod'); // Default to 'card'
  const creditCard = watch('creditCard');

  const structureDataAndSubmit = async (data: any): Promise<void> => {
    const amount = parseFloat(data.amount);
    const paymentMethod = data.paymentMethod;
    const creditCard = data.creditCard;
    const paymentData: CashOrCardPayment = {
      amountInCents: Math.round(amount * 100),
      paymentMethod,
      paymentMethodId: creditCard || undefined,
    };
    await submitPayment(paymentData);
  };

  const handleDialogClose = (): void => {
    handleClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      disableScrollLock
      sx={{
        '.MuiPaper-root': {
          padding: 1,
          width: '700px',
          maxWidth: 'initial',
        },
      }}
    >
      <form onSubmit={handleSubmit(structureDataAndSubmit)} noValidate>
        <DialogTitle variant="h4" color="primary.dark" sx={{ width: '100%' }}>
          Payment
        </DialogTitle>
        <DialogContent>
          <Grid container direction="column" spacing={2} sx={{ marginBottom: 2 }}>
            <Grid item>
              <PatientHeader patient={patient} />
            </Grid>
            <Grid item sx={{ marginBottom: 1 }}>
              <FormControl variant="outlined" fullWidth required>
                <InputLabel shrink required error={Boolean(formState.errors.amount)}>
                  Amount
                </InputLabel>
                <OutlinedInput
                  id="amount"
                  label="Amount, $"
                  placeholder="Enter amount in dollars"
                  size="small"
                  notched
                  error={Boolean(formState.errors.amount)}
                  {...register('amount', { required: true })}
                />
                {formState.errors.amount && (
                  <FormHelperText error={true}>{formState.errors.amount?.message}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid item>
              <FormControl variant="outlined" fullWidth required>
                <InputLabel shrink id="payment-method-radio-group">
                  Payment method
                </InputLabel>
                <Controller
                  name="paymentMethod"
                  control={control}
                  aria-labelledby="payment-method-radio-group"
                  render={({ field }) => (
                    <RadioGroup row {...field}>
                      <FormControlLabel value="card" control={<Radio />} label="Card" />
                      <FormControlLabel value="cash" control={<Radio />} label="Cash" />
                      <FormControlLabel value="check" control={<Radio />} label="Check" />
                    </RadioGroup>
                  )}
                />
              </FormControl>
            </Grid>
          </Grid>
          <Grid
            item
            sx={{
              minHeight: '150px',
            }}
          >
            <Box
              sx={{
                display: paymentMethod === 'card' ? 'initial' : 'none',
              }}
            >
              <SelectCreditCard
                patient={patient}
                selectedCardId={creditCard}
                handleCardSelected={(newVal: string | undefined) => {
                  setValue('creditCard', newVal ?? '');
                }}
                error={formState.errors.creditCard?.message}
              />
            </Box>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', marginLeft: 1 }}>
          <Button variant="text" onClick={handleDialogClose} size="medium" sx={buttonSx}>
            Cancel
          </Button>
          <LoadingButton
            data-testid={dataTestIds.visitDetailsPage.cancelVisitDialogue}
            loading={isSubmitting}
            type="submit"
            variant="contained"
            color="primary"
            size="medium"
            sx={buttonSx}
          >
            Process Payment
          </LoadingButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}
