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
import { useQueryClient } from '@tanstack/react-query';
import { Questionnaire } from 'fhir/r4b';
import React, { useEffect } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { FormSelect, FormTextField, LabeledField, Option } from 'src/components/form';
import { BasicDatePicker } from 'src/components/form/DatePicker';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { structureQuestionnaireResponse } from 'src/helpers/qr-structure';
import { useUpdatePatientAccount } from 'src/hooks/useGetPatient';
import { usePatientStore } from 'src/state/patient.store';
import {
  InsurancePlanDTO,
  InsurancePlanType,
  isPostalCodeValid,
  PATIENT_RECORD_CONFIG,
  REQUIRED_FIELD_ERROR_MESSAGE,
  VALUE_SETS,
} from 'utils';

interface AddInsuranceModalProps {
  open: boolean;
  patientId: string;
  questionnaire: Questionnaire;
  priorityOptions: { value: string; label: string }[];
  onClose: () => void;
}

const insurance = PATIENT_RECORD_CONFIG.FormFields.insurance.items[0];

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
    defaultValues: {
      [insurance.insurancePriority.key]: priorityOptions[0]?.value || 'Primary',
      [insurance.insuranceCarrier.key]: null,
      [insurance.insurancePlanType.key]: null,
      [insurance.memberId.key]: '',
      [insurance.firstName.key]: '',
      [insurance.middleName.key]: '',
      [insurance.lastName.key]: '',
      [insurance.birthDate.key]: '',
      [insurance.birthSex.key]: '',
      [insurance.relationship.key]: '',
      [insurance.streetAddress.key]: '',
      [insurance.addressLine2.key]: '',
      [insurance.city.key]: '',
      [insurance.state.key]: null,
      [insurance.zip.key]: '',
      [insurance.additionalInformation.key]: '',
    } as any,
  });

  const { control, formState, handleSubmit, setValue, watch } = methods;
  const { errors, defaultValues } = formState;

  const { insurancePlans } = usePatientStore();
  const queryClient = useQueryClient();
  const {
    mutate,
    isPending: isLoading,
    isIdle,
    reset,
    isSuccess,
  } = useUpdatePatientAccount(() => {
    void queryClient.invalidateQueries({ queryKey: ['patient-coverages'] });
  }, 'Coverage added to patient account successfully.');

  const insurancePriority = watch(insurance.insurancePriority.key);
  const workersComp = insurancePriority === 'Workers Comp';

  const onSubmit = (data: any): void => {
    // send the data to a zambda

    const questionnaireResponse = structureQuestionnaireResponse(questionnaire, data, patientId);
    mutate(questionnaireResponse);
  };

  useEffect(() => {
    if (!open) {
      methods.reset();
    }
  }, [open, methods]);

  useEffect(() => {
    if (priorityOptions.length === 1 && priorityOptions[0]?.value) {
      methods.setValue(insurance.insurancePriority.key, priorityOptions[0].value);
    }
  }, [priorityOptions, methods]);

  useEffect(() => {
    if (!open && !isIdle) {
      reset();
    } else if (open && isSuccess) {
      onClose();
    }
  }, [open, onClose, isIdle, isSuccess, reset]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      PaperProps={{ sx: { p: 2, maxWidth: 'none', minHeight: '680px' } }}
      data-testid={dataTestIds.addInsuranceDialog.id}
    >
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
              <LabeledField label="Type" required error={!!errors[insurance.insurancePriority.key]}>
                <FormSelect
                  data-testid={dataTestIds.addInsuranceDialog.type}
                  name={insurance.insurancePriority.key}
                  variant="outlined"
                  control={control}
                  options={priorityOptions}
                  defaultValue={defaultValues?.insurancePriority || 'Primary'}
                  disabled={priorityOptions.length === 1}
                  rules={{
                    required: REQUIRED_FIELD_ERROR_MESSAGE,
                  }}
                />
              </LabeledField>
            </Grid>
            <Grid item xs={3}>
              <LabeledField label="Insurance carrier" required error={!!errors[insurance.insuranceCarrier.key]}>
                <Controller
                  name={insurance.insuranceCarrier.key}
                  control={control}
                  rules={{
                    required: REQUIRED_FIELD_ERROR_MESSAGE,
                    validate: (value) =>
                      insurancePlans.some((option) => `Organization/${option.id}` === value?.reference),
                  }}
                  render={({ field: { value }, fieldState: { error } }) => {
                    const isLoading = insurancePlans.length === 0;

                    const selectedOption = insurancePlans.find(
                      (option) => `Organization/${option.id}` === value?.reference
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
                        getOptionLabel={(option) =>
                          option.payerId || option.name ? `${option?.payerId || 'N/A'} - ${option?.name || 'N/A'}` : ''
                        }
                        onChange={(_, newValue) => {
                          if (newValue) {
                            setValue(
                              insurance.insuranceCarrier.key,
                              { reference: `Organization/${newValue.id}`, display: newValue.name },
                              { shouldDirty: true }
                            );
                          } else {
                            setValue(insurance.insuranceCarrier.key, null);
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
                            data-testid={dataTestIds.addInsuranceDialog.insuranceCarrier}
                          />
                        )}
                      />
                    );
                  }}
                />
              </LabeledField>
            </Grid>
            <Grid item xs={3}>
              <LabeledField label="Insurance type" error={!!errors[insurance.insurancePlanType.key]}>
                <Controller
                  name={insurance.insurancePlanType.key}
                  control={control}
                  rules={{
                    validate: (value) =>
                      !value || VALUE_SETS.insuranceTypeOptions.some((option) => option.candidCode === value),
                  }}
                  render={({ field: { value }, fieldState: { error } }) => {
                    const selectedOption = VALUE_SETS.insuranceTypeOptions.find(
                      (option) => option.candidCode === value
                    );
                    return (
                      <Autocomplete
                        options={VALUE_SETS.insuranceTypeOptions}
                        value={selectedOption ?? ({} as InsurancePlanType)}
                        isOptionEqualToValue={(option, value) => option?.candidCode === value?.candidCode}
                        getOptionLabel={(option) =>
                          option.candidCode || option.label ? `${option.candidCode} - ${option.label}` : ''
                        }
                        onChange={(_, newValue) => {
                          if (newValue) {
                            setValue(insurance.insurancePlanType.key, newValue.candidCode, { shouldDirty: true });
                          } else {
                            setValue(insurance.insurancePlanType.key, null);
                          }
                        }}
                        fullWidth
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            variant="outlined"
                            error={!!error}
                            helperText={error?.message}
                            data-testid={dataTestIds.addInsuranceDialog.planType}
                          />
                        )}
                      />
                    );
                  }}
                />
              </LabeledField>
            </Grid>
            <Grid item xs={3} data-testid={dataTestIds.addInsuranceDialog.memberId}>
              <LabeledField label="Member ID" required error={!!errors[insurance.memberId.key]}>
                <FormTextField
                  variant="outlined"
                  name={insurance.memberId.key}
                  control={control}
                  defaultValue={''}
                  rules={{
                    required: REQUIRED_FIELD_ERROR_MESSAGE,
                  }}
                />
              </LabeledField>
            </Grid>
            {!workersComp && (
              <>
                {/* Empty grid item to maintain proper column alignment after adding the insurance type field */}
                <Grid item xs={6}></Grid>
                <Grid item xs={3} data-testid={dataTestIds.addInsuranceDialog.policyHoldersFirstName}>
                  <LabeledField label="Policy holder's first name" required error={!!errors[insurance.firstName.key]}>
                    <FormTextField
                      variant="outlined"
                      name={insurance.firstName.key}
                      control={control}
                      defaultValue={''}
                      rules={{
                        required: REQUIRED_FIELD_ERROR_MESSAGE,
                      }}
                    />
                  </LabeledField>
                </Grid>
                <Grid item xs={3} data-testid={dataTestIds.addInsuranceDialog.policyHoldersMiddleName}>
                  <LabeledField label="Policy holder's middle name">
                    <FormTextField
                      InputLabelProps={{
                        shrink: true,
                        sx: {
                          fontWeight: 'bold',
                        },
                      }}
                      variant="outlined"
                      name={insurance.middleName.key}
                      control={control}
                      defaultValue={''}
                    />
                  </LabeledField>
                </Grid>
                <Grid item xs={3} data-testid={dataTestIds.addInsuranceDialog.policyHoldersLastName}>
                  <LabeledField label="Policy holder's last name" required error={!!errors[insurance.lastName.key]}>
                    <FormTextField
                      variant="outlined"
                      name={insurance.lastName.key}
                      control={control}
                      defaultValue={''}
                      rules={{
                        required: REQUIRED_FIELD_ERROR_MESSAGE,
                      }}
                    />
                  </LabeledField>
                </Grid>
                <Grid item xs={3}>
                  <LabeledField
                    label="Policy holder's date of birth"
                    required
                    error={!!errors[insurance.birthDate.key]}
                  >
                    <BasicDatePicker
                      name={insurance.birthDate.key}
                      variant="outlined"
                      control={control}
                      rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                      defaultValue={''}
                      dataTestId={dataTestIds.addInsuranceDialog.policyHoldersDateOfBirth}
                      component="Field"
                    />
                  </LabeledField>
                </Grid>
                <Grid item xs={3} data-testid={dataTestIds.addInsuranceDialog.policyHoldersSex}>
                  <LabeledField label="Policy holder's sex" required error={!!errors[insurance.birthSex.key]}>
                    <FormSelect
                      variant="outlined"
                      name={insurance.birthSex.key}
                      control={control}
                      defaultValue={''}
                      options={VALUE_SETS.birthSexOptions}
                      rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                    />
                  </LabeledField>
                </Grid>
                <Grid item xs={3} data-testid={dataTestIds.addInsuranceDialog.relationship}>
                  <LabeledField
                    label="Patient’s relationship to insured"
                    required
                    error={!!errors[insurance.relationship.key]}
                  >
                    <FormSelect
                      variant="outlined"
                      name={insurance.relationship.key}
                      control={control}
                      defaultValue={''}
                      options={VALUE_SETS.relationshipToInsuredOptions}
                      rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                    />
                  </LabeledField>
                </Grid>
                <Grid item xs={3} data-testid={dataTestIds.addInsuranceDialog.streetAddress}>
                  <LabeledField label="Street address" required error={!!errors[insurance.streetAddress.key]}>
                    <FormTextField
                      placeholder="No., Street"
                      variant="outlined"
                      name={insurance.streetAddress.key}
                      control={control}
                      defaultValue={''}
                      rules={{
                        required: REQUIRED_FIELD_ERROR_MESSAGE,
                      }}
                    />
                  </LabeledField>
                </Grid>
                <Grid item xs={3} data-testid={dataTestIds.addInsuranceDialog.addressLine2}>
                  <LabeledField label="Address line 2">
                    <FormTextField
                      placeholder="No., Street"
                      variant="outlined"
                      name={insurance.addressLine2.key}
                      control={control}
                      defaultValue={''}
                    />
                  </LabeledField>
                </Grid>
                <Grid item xs={1} data-testid={dataTestIds.addInsuranceDialog.city}>
                  <LabeledField label="City" required error={!!errors[insurance.city.key]}>
                    <FormTextField
                      variant="outlined"
                      name={insurance.city.key}
                      control={control}
                      defaultValue={''}
                      rules={{
                        required: REQUIRED_FIELD_ERROR_MESSAGE,
                      }}
                    />
                  </LabeledField>
                </Grid>
                <Grid item xs={1}>
                  <LabeledField label="State" required error={!!errors[insurance.state.key]}>
                    <Controller
                      name={insurance.state.key}
                      control={control}
                      defaultValue={null}
                      rules={{
                        required: REQUIRED_FIELD_ERROR_MESSAGE,
                        validate: (value) => !value || VALUE_SETS.stateOptions.some((option) => option.value === value),
                      }}
                      render={({ field: { onChange, value }, fieldState: { error } }) => (
                        <Autocomplete
                          data-testid={dataTestIds.addInsuranceDialog.state}
                          options={VALUE_SETS.stateOptions}
                          value={(VALUE_SETS.stateOptions.find((option) => option.value === value) || null) as Option}
                          getOptionLabel={(option) => option.label || ''}
                          isOptionEqualToValue={(option, value) =>
                            option?.value === value?.value || (!option && !value)
                          }
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
                <Grid item xs={1} data-testid={dataTestIds.addInsuranceDialog.zip}>
                  <LabeledField label="ZIP" required error={!!errors[insurance.zip.key]}>
                    <FormTextField
                      variant="outlined"
                      name={insurance.zip.key}
                      control={control}
                      defaultValue={''}
                      rules={{
                        required: REQUIRED_FIELD_ERROR_MESSAGE,
                        validate: (value: string) => isPostalCodeValid(value) || 'Must be 5 digits',
                      }}
                    />
                  </LabeledField>
                </Grid>
                <Grid item xs={9} data-testid={dataTestIds.addInsuranceDialog.additionalInformation}>
                  <LabeledField label="Additional insurance information">
                    <FormTextField
                      variant="outlined"
                      name={insurance.additionalInformation.key}
                      control={control}
                      defaultValue={''}
                    />
                  </LabeledField>
                </Grid>
              </>
            )}
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
        <RoundedButton
          data-testid={dataTestIds.addInsuranceDialog.addInsuranceButton}
          variant="contained"
          color="primary"
          sx={{
            borderRadius: 25,
            textTransform: 'none',
            fontSize: 15,
            fontWeight: 'bold',
          }}
          onClick={handleSubmit(onSubmit)}
          loading={isLoading}
        >
          Add Insurance
        </RoundedButton>
      </DialogActions>
    </Dialog>
  );
};
