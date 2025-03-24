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
import React, { useEffect } from 'react';
import { useForm, Controller, FormProvider } from 'react-hook-form';
import { InsurancePlanDTO, isPostalCodeValid, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import { RELATIONSHIP_TO_INSURED_OPTIONS, SEX_OPTIONS, STATE_OPTIONS } from '../../constants';
import { BasicDatePicker as DatePicker, FormSelect, FormTextField, LabeledField, Option } from '../form';
import { usePatientStore } from '../../state/patient.store';
import { Questionnaire } from 'fhir/r4b';
import { FormFields as AllFormFields } from '../../constants';
import { useUpdatePatientAccount } from '../../hooks/useGetPatient';
import { structureQuestionnaireResponse } from '../../helpers/qr-structure';
import { useQueryClient } from 'react-query';
import { LoadingButton } from '@mui/lab';

interface AddInsuranceModalProps {
  open: boolean;
  patientId: string;
  questionnaire: Questionnaire;
  priorityOptions: { value: string; label: string }[];
  onClose: () => void;
}

const FormFields = AllFormFields.insurance[0];

export const AddInsuranceModal: React.FC<AddInsuranceModalProps> = ({
  open,
  patientId,
  questionnaire,
  priorityOptions,
  onClose,
}) => {
  const theme = useTheme();

  const methods = useForm({
    mode: 'onBlur',
  });

  const { control, formState, handleSubmit, setValue } = methods;
  const { errors } = formState;

  const { insurancePlans } = usePatientStore();
  const queryClient = useQueryClient();
  const submitQR = useUpdatePatientAccount(() => {
    void queryClient.invalidateQueries('patient-account-get');
  });

  const onSubmit = (data: any): void => {
    // send the data to a zambda
    const questionnaireResponse = structureQuestionnaireResponse(questionnaire, data, patientId);
    submitQR.mutate(questionnaireResponse);
  };

  useEffect(() => {
    if (!open) {
      methods.reset();
    }
  }, [open, methods]);

  useEffect(() => {
    if (!open && !submitQR.isIdle) {
      submitQR.reset();
    } else if (open && submitQR.isSuccess) {
      onClose();
    }
  }, [open, submitQR, onClose]);

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
      <FormProvider {...methods}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Grid container spacing={2} columns={9} sx={{ pt: 1 }}>
            <Grid item xs={3}>
              <LabeledField label="Type" required error={!!errors[FormFields.insurancePriority.key]}>
                <FormSelect
                  name={FormFields.insurancePriority.key}
                  variant="outlined"
                  control={control}
                  options={priorityOptions}
                  defaultValue={priorityOptions[0]?.value ?? 'Primary'}
                  rules={{
                    required: REQUIRED_FIELD_ERROR_MESSAGE,
                  }}
                  disabled={priorityOptions.length === 1}
                />
              </LabeledField>
            </Grid>
            <Grid item xs={3}>
              <LabeledField label="Insurance carrier" required error={!!errors[FormFields.insuranceCarrier.key]}>
                <Controller
                  name={FormFields.insuranceCarrier.key}
                  control={control}
                  rules={{
                    required: REQUIRED_FIELD_ERROR_MESSAGE,
                    validate: (value) =>
                      insurancePlans.some((option) => `InsurancePlan/${option.id}` === value?.reference),
                  }}
                  render={({ field: { value }, fieldState: { error } }) => {
                    const isLoading = insurancePlans.length === 0;

                    const selectedOption = insurancePlans.find(
                      (option) => `InsurancePlan/${option.id}` === value?.reference
                    );
                    return (
                      <Autocomplete
                        options={insurancePlans}
                        loading={isLoading}
                        loadingText={'Loading...'}
                        value={selectedOption ?? ({} as InsurancePlanDTO)}
                        isOptionEqualToValue={(option, value) => {
                          return option?.id === value?.id;
                        }}
                        getOptionLabel={(option) => option.name || ''}
                        onChange={(_, newValue) => {
                          if (newValue) {
                            setValue(
                              FormFields.insuranceCarrier.key,
                              { reference: `InsurancePlan/${newValue.id}`, display: newValue.name },
                              { shouldDirty: true }
                            );
                          } else {
                            setValue(FormFields.insuranceCarrier.key, null);
                          }
                        }}
                        disableClearable
                        fullWidth
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            variant="outlined"
                            error={!!error}
                            required
                            helperText={error?.message}
                          />
                        )}
                      />
                    );
                  }}
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
      </FormProvider>
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
        <LoadingButton
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
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};
