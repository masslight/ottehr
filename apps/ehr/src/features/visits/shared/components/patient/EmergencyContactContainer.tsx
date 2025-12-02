import { Autocomplete, Box, Checkbox, FormControlLabel, TextField } from '@mui/material';
import { FC, useEffect, useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { FormSelect, FormTextField } from 'src/components/form';
import InputMask from 'src/components/InputMask';
import { Row, Section } from 'src/components/layout';
import {
  EMERGENCY_CONTACT_RELATIONSHIP_OPTIONS,
  FormFields as AllFormFields,
  PatientAddressFields,
  STATE_OPTIONS,
} from 'src/constants';
import { isPhoneNumberValid, isPostalCodeValid, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';

const { emergencyContact: FormFields } = AllFormFields;

export const EmergencyContactContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const { control, watch, setValue } = useFormContext();

  const emergencyAddressFields = useMemo(
    () => [
      FormFields.streetAddress.key,
      FormFields.addressLine2.key,
      FormFields.city.key,
      FormFields.state.key,
      FormFields.zip.key,
    ],
    []
  );

  const patientAddressData = watch(PatientAddressFields);
  const emergencyAddressData = watch(emergencyAddressFields);
  const sameAsPatientAddress = watch(FormFields.addressAsPatient.key, false);

  useEffect(() => {
    if (!sameAsPatientAddress) return;
    for (let i = 0; i < emergencyAddressData.length; i++) {
      if (patientAddressData[i] && emergencyAddressData[i] !== patientAddressData[i]) {
        setValue(emergencyAddressFields[i], patientAddressData[i]);
      }
    }
  }, [emergencyAddressData, emergencyAddressFields, patientAddressData, sameAsPatientAddress, setValue]);

  return (
    <Section title="Emergency contact information">
      <Row label={FormFields.relationship.label} required>
        <FormSelect
          name={FormFields.relationship.key}
          control={control}
          options={EMERGENCY_CONTACT_RELATIONSHIP_OPTIONS}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
            validate: (value: string) =>
              EMERGENCY_CONTACT_RELATIONSHIP_OPTIONS.some((option) => option.value === value),
          }}
          id={FormFields.relationship.key}
          disabled={isLoading}
        />
      </Row>
      <Row label={FormFields.firstName.label} required inputId={FormFields.firstName.key}>
        <FormTextField
          name={FormFields.firstName.key}
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          id={FormFields.firstName.key}
          disabled={isLoading}
        />
      </Row>
      <Row label={FormFields.middleName.label} inputId={FormFields.middleName.key}>
        <FormTextField
          name={FormFields.middleName.key}
          control={control}
          id={FormFields.middleName.key}
          disabled={isLoading}
        />
      </Row>
      <Row label={FormFields.lastName.label} required inputId={FormFields.lastName.key}>
        <FormTextField
          name={FormFields.lastName.key}
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          id={FormFields.lastName.key}
          disabled={isLoading}
        />
      </Row>
      <Row label={FormFields.phone.label} required inputId={FormFields.phone.key}>
        <FormTextField
          id={FormFields.phone.key}
          name={FormFields.phone.key}
          control={control}
          inputProps={{ mask: '(000) 000-0000' }}
          InputProps={{
            inputComponent: InputMask as any,
          }}
          rules={{
            validate: (value: string) => {
              if (!value) return true;
              return (
                isPhoneNumberValid(value) ||
                'Phone number must be 10 digits in the format (xxx) xxx-xxxx and a valid number'
              );
            },
            required: REQUIRED_FIELD_ERROR_MESSAGE,
          }}
          disabled={isLoading}
        />
      </Row>
      <Row label=" ">
        <Controller
          name={FormFields.addressAsPatient.key}
          control={control}
          render={({ field: { value, ...field } }) => (
            <FormControlLabel
              control={
                <Checkbox
                  {...field}
                  checked={value ?? false}
                  onChange={(e) => field.onChange(e.target.checked)}
                  disabled={isLoading}
                />
              }
              label={FormFields.addressAsPatient.label}
            />
          )}
        />
      </Row>
      <Row label={FormFields.streetAddress.label} inputId={FormFields.streetAddress.key}>
        <FormTextField
          name={FormFields.streetAddress.key}
          control={control}
          id={FormFields.streetAddress.key}
          disabled={isLoading || (sameAsPatientAddress && Boolean(patientAddressData[0]))}
        />
      </Row>
      <Row label={FormFields.addressLine2.label} inputId={FormFields.addressLine2.key}>
        <FormTextField
          name={FormFields.addressLine2.key}
          control={control}
          id={FormFields.addressLine2.key}
          disabled={isLoading || sameAsPatientAddress}
        />
      </Row>
      <Row label="City, State, ZIP">
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormTextField
            name={FormFields.city.key}
            control={control}
            disabled={isLoading || (sameAsPatientAddress && Boolean(patientAddressData[2]))}
          />
          <Controller
            name={FormFields.state.key}
            control={control}
            render={({ field: { value }, fieldState: { error } }) => (
              <Autocomplete
                options={STATE_OPTIONS.map((option) => option.value)}
                value={value ?? ''}
                onChange={(_, newValue) => {
                  setValue(FormFields.state.key, newValue ?? '');
                }}
                fullWidth
                renderInput={(params) => (
                  <TextField {...params} variant="standard" error={!!error} helperText={error?.message} />
                )}
                disabled={isLoading || (sameAsPatientAddress && Boolean(patientAddressData[3]))}
              />
            )}
          />
          <FormTextField
            name={FormFields.zip.key}
            control={control}
            rules={{
              validate: (value: string) => {
                if (!value) return true;
                return isPostalCodeValid(value) || 'Must be 5 digits';
              },
            }}
            disabled={isLoading || (sameAsPatientAddress && Boolean(patientAddressData[4]))}
          />
        </Box>
      </Row>
    </Section>
  );
};
