import { Close } from '@mui/icons-material';
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
  useTheme,
} from '@mui/material';
import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { InsurancePlanDTO, isPostalCodeValid, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import { RELATIONSHIP_TO_INSURED_OPTIONS, SEX_OPTIONS, STATE_OPTIONS } from '../../constants';
import { BasicDatePicker as DatePicker, FormSelect, FormTextField, LabeledField, Option } from '../form';
import { usePatientStore } from '../../state/patient.store';
import { QuestionnaireResponseItem } from 'fhir/r4b';

interface AddInsuranceModalProps {
  open: boolean;
  onClose: () => void;
}

const updateQRUrl = import.meta.env.VITE_APP_EHR_ACCOUNT_UPDATE_FORM;

const FormFields = {
  insuranceCarrier: { key: 'insurance-carrier', type: 'Reference' },
  memberId: { key: 'insurance-member-id', type: 'String' },
  firstName: { key: 'policy-holder-first-name', type: 'String' },
  middleName: { key: 'policy-holder-middle-name', type: 'String' },
  lastName: { key: 'policy-holder-last-name', type: 'String' },
  birthDate: { key: 'policy-holder-date-of-birth', type: 'String' },
  birthSex: { key: 'policy-holder-birth-sex', type: 'String' },
  streetAddress: { key: 'policy-holder-address', type: 'String' },
  addressLine2: { key: 'policy-holder-address-additional-line', type: 'String' },
  city: { key: 'policy-holder-city', type: 'String' },
  state: { key: 'policy-holder-state', type: 'String' },
  zip: { key: 'policy-holder-zip', type: 'String' },
  relationship: { key: 'patient-relationship-to-insured', type: 'String' },
};

export const AddInsuranceModal: React.FC<AddInsuranceModalProps> = ({ open, onClose }) => {
  const theme = useTheme();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const { insurancePlans, patient } = usePatientStore();
  // console.log('errors', errors);

  const onSubmit = (data: any): void => {
    if (!patient) return;
    // send the data to a zambda
    const itemized = Object.keys(data).reduce((acc, key) => {
      const val = data[key];
      const fieldType = Object.entries(FormFields).find(([, field]) => field.key === key)?.[1]?.type;
      if (fieldType === 'Reference') {
        acc.push({ linkId: key, answer: [{ valueReference: { reference: `InsurancePlan/${val}` } }] });
      } else if (fieldType === 'String') {
        acc.push({ linkId: key, answer: [{ valueString: val }] });
      }
      return acc;
    }, [] as QuestionnaireResponseItem[]);
    const questionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      questionnaire: updateQRUrl,
      status: 'completed',
      subject: { reference: `Patient/${patient.id}` },
      item: itemized,
    };
    console.log('data', data, questionnaireResponse);
    // onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { p: 2, maxWidth: 'none' } }}>
      <DialogTitle
        variant="h5"
        color="secondary.main"
        sx={{
          width: '100%',
          fontSize: '24px',
          color: theme.palette.primary.dark,
          fontWeight: '600 !important',
        }}
      >
        Add Insurance
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
          }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Grid container spacing={2} columns={9} sx={{ pt: 1 }}>
          <Grid item xs={3}>
            <LabeledField label="Insurance carrier" required error={!!errors[FormFields.insuranceCarrier.key]}>
              <Controller
                name={FormFields.insuranceCarrier.key}
                control={control}
                defaultValue={null}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                  validate: (value) => insurancePlans.some((option) => option.id === value),
                }}
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <Autocomplete
                    options={insurancePlans}
                    value={(insurancePlans.find((option) => option.id === value) || null) as InsurancePlanDTO}
                    getOptionLabel={(option) => option?.name || ''}
                    isOptionEqualToValue={(option, value) => option?.id === value?.id || (!option && !value)}
                    onChange={(_, newValue) => {
                      console.log(newValue);
                      onChange(newValue?.id || null);
                    }}
                    disableClearable
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        error={!!error}
                        required
                        placeholder="Select"
                        helperText={error?.message}
                      />
                    )}
                  />
                )}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={3}>
            <LabeledField label="Member ID" required error={!!errors[FormFields.memberId.key]}>
              <FormTextField
                variant="outlined"
                name={FormFields.memberId.key}
                control={control}
                defaultValue={''}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                }}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={3} />
          <Grid item xs={3}>
            <LabeledField label="Policy holder's first name" required error={!!errors[FormFields.firstName.key]}>
              <FormTextField
                variant="outlined"
                name={FormFields.firstName.key}
                control={control}
                defaultValue={''}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                }}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={3}>
            <LabeledField label="Policy holder's middle name">
              <FormTextField
                InputLabelProps={{
                  shrink: true,
                  sx: {
                    fontWeight: 'bold',
                  },
                }}
                variant="outlined"
                name={FormFields.middleName.key}
                control={control}
                defaultValue={''}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={3}>
            <LabeledField label="Policy holder's last name" required error={!!errors[FormFields.lastName.key]}>
              <FormTextField
                variant="outlined"
                name={FormFields.lastName.key}
                control={control}
                defaultValue={''}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                }}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={3}>
            <LabeledField label="Policy holder's date of birth" required error={!!errors[FormFields.birthDate.key]}>
              <DatePicker
                name={FormFields.birthDate.key}
                variant="outlined"
                control={control}
                required={true}
                defaultValue={''}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={3}>
            <LabeledField label="Policy holder's sex" required error={!!errors[FormFields.birthSex.key]}>
              <FormSelect
                variant="outlined"
                name={FormFields.birthSex.key}
                control={control}
                defaultValue={''}
                options={SEX_OPTIONS}
                rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={3}>
            <LabeledField
              label="Patient’s relationship to insured"
              required
              error={!!errors[FormFields.relationship.key]}
            >
              <FormSelect
                variant="outlined"
                name={FormFields.relationship.key}
                control={control}
                defaultValue={''}
                options={RELATIONSHIP_TO_INSURED_OPTIONS}
                rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={3}>
            <LabeledField label="Street address" required error={!!errors[FormFields.streetAddress.key]}>
              <FormTextField
                placeholder="No., Street"
                variant="outlined"
                name={FormFields.streetAddress.key}
                control={control}
                defaultValue={''}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                }}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={3}>
            <LabeledField label="Address line 2">
              <FormTextField
                placeholder="No., Street"
                variant="outlined"
                name={FormFields.addressLine2.key}
                control={control}
                defaultValue={''}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={1}>
            <LabeledField label="City" required error={!!errors[FormFields.city.key]}>
              <FormTextField
                variant="outlined"
                name={FormFields.city.key}
                control={control}
                defaultValue={''}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                }}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={1}>
            <LabeledField label="State" required error={!!errors[FormFields.state.key]}>
              <Controller
                name={FormFields.state.key}
                control={control}
                defaultValue={null}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                  validate: (value) => !value || STATE_OPTIONS.some((option) => option.value === value),
                }}
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <Autocomplete
                    options={STATE_OPTIONS}
                    value={(STATE_OPTIONS.find((option) => option.value === value) || null) as Option}
                    getOptionLabel={(option) => option.label || ''}
                    isOptionEqualToValue={(option, value) => option?.value === value?.value || (!option && !value)}
                    onChange={(_, newValue) => {
                      onChange(newValue?.value || null);
                    }}
                    disableClearable
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        required
                        error={!!error}
                        placeholder="Select"
                        helperText={error?.message}
                      />
                    )}
                  />
                )}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={1}>
            <LabeledField label="ZIP" required error={!!errors[FormFields.zip.key]}>
              <FormTextField
                variant="outlined"
                name={FormFields.zip.key}
                control={control}
                defaultValue={''}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                  validate: (value: string) => isPostalCodeValid(value) || 'Must be 5 digits',
                }}
              />
            </LabeledField>
          </Grid>
          <Grid item xs={9}>
            <LabeledField label="Additional insurance information">
              <FormTextField
                variant="outlined"
                name="Coverage/additionalInformation"
                control={control}
                defaultValue={''}
              />
            </LabeledField>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 3, justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          color="primary"
          sx={{
            borderRadius: 25,
            textTransform: 'none',
            fontSize: 15,
            fontWeight: 'bold',
          }}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          sx={{
            borderRadius: 25,
            textTransform: 'none',
            fontSize: 15,
            fontWeight: 'bold',
          }}
          onClick={handleSubmit(onSubmit)}
        >
          Add Insurance
        </Button>
      </DialogActions>
    </Dialog>
  );
};
