import LoadingButton from '@mui/lab/LoadingButton';
import {
  Button,
  capitalize,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  OutlinedInput,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';
import { ReactElement } from 'react';
import { dataTestIds } from '../../constants/data-test-ids';
import { Patient } from 'fhir/r4b';
import {
  DOB_DATE_FORMAT,
  formatPhoneNumberDisplay,
  getFirstName,
  getLastName,
  getMiddleName,
  getPhoneNumberForIndividual,
} from 'utils';
import { DateTime } from 'luxon';
import { Controller, useForm } from 'react-hook-form';
import SelectCreditCard from '../SelectCreditCard';

interface PaymentDialogProps {
  handleClose: () => void;
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

export default function ({ handleClose, open, patient }: PaymentDialogProps): ReactElement {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const buttonSx = {
    fontWeight: 500,
    textTransform: 'none',
    borderRadius: 6,
  };

  const { handleSubmit, register, watch, control, getValues, setValue } = useForm({
    defaultValues: {
      amount: '',
      paymentMethod: 'card',
      creditCard: '',
    },
  });

  const paymentMethod = watch('paymentMethod'); // Default to 'card'
  const creditCard = watch('creditCard');

  console.log('Payment method selected:', paymentMethod);
  console.log('Credit card selected:', creditCard);
  console.log('Form values:', getValues());

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
      <form onSubmit={handleSubmit((event) => console.log(event))} noValidate>
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
                <InputLabel shrink>Amount</InputLabel>
                <OutlinedInput
                  id="amount"
                  label="Amount, $"
                  placeholder="Enter amount in dollars"
                  inputMode="numeric"
                  size="small"
                  notched
                  {...register('amount', { required: true })}
                />
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
          {paymentMethod === 'card' && (
            <Grid item>
              <SelectCreditCard
                patient={patient}
                selectedCardId={creditCard}
                handleCardSelected={(newVal: string | undefined) => {
                  setValue('creditCard', newVal ?? '');
                }}
              />
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'flex-start', marginLeft: 1 }}>
          <Button variant="text" onClick={handleDialogClose} size="medium" sx={buttonSx}>
            Cancel
          </Button>
          <LoadingButton
            data-testid={dataTestIds.visitDetailsPage.cancelVisitDialogue}
            loading={false}
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
