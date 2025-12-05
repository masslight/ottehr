import { Autocomplete, Box, TextField } from '@mui/material';
import { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { FormTextField } from 'src/components/form';
import InputMask from 'src/components/InputMask';
import { Row, Section } from 'src/components/layout';
import { dataTestIds } from 'src/constants/data-test-ids';
import { emailRegex, isPhoneNumberValid, isPostalCodeValid, PATIENT_RECORD_CONFIG } from 'utils';

const { employerInformation } = PATIENT_RECORD_CONFIG.FormFields;

export const EmployerInformationContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const { control, setValue } = useFormContext();

  return (
    <Section title="Employer information" dataTestId={dataTestIds.employerInformationContainer.id}>
      <Row label={employerInformation.employerName.label}>
        <FormTextField
          name={employerInformation.employerName.key}
          control={control}
          data-testid={dataTestIds.employerInformationContainer.employerName}
          disabled={isLoading}
        />
      </Row>
      <Row label={employerInformation.addressLine1.label}>
        <FormTextField
          name={employerInformation.addressLine1.key}
          control={control}
          data-testid={dataTestIds.employerInformationContainer.addressLine1}
          disabled={isLoading}
        />
      </Row>
      <Row label={employerInformation.addressLine2.label}>
        <FormTextField
          name={employerInformation.addressLine2.key}
          control={control}
          data-testid={dataTestIds.employerInformationContainer.addressLine2}
          disabled={isLoading}
        />
      </Row>
      <Row label="City, State, ZIP">
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormTextField
            name={employerInformation.city.key}
            control={control}
            data-testid={dataTestIds.employerInformationContainer.city}
            disabled={isLoading}
          />
          <Controller
            name={employerInformation.state.key}
            control={control}
            render={({ field: { value }, fieldState: { error } }) => (
              <Autocomplete
                options={PATIENT_RECORD_CONFIG.formValueSets.stateOptions.map((option) => option.value)}
                value={value ?? ''}
                disableClearable
                onChange={(_, newValue) => {
                  setValue(employerInformation.state.key, newValue ?? '');
                }}
                renderInput={(params) => (
                  <TextField {...params} variant="standard" required error={!!error} helperText={error?.message} />
                )}
                fullWidth
                data-testid={dataTestIds.employerInformationContainer.state}
                disabled={isLoading}
              />
            )}
          />
          <FormTextField
            name={employerInformation.zip.key}
            control={control}
            data-testid={dataTestIds.employerInformationContainer.zip}
            rules={{
              validate: (value: string) => {
                if (!value) return true;
                return isPostalCodeValid(value) || 'Must be 5 digits';
              },
            }}
            disabled={isLoading}
          />
        </Box>
      </Row>
      <Row label={employerInformation.contactFirstName.label}>
        <FormTextField
          name={employerInformation.contactFirstName.key}
          control={control}
          data-testid={dataTestIds.employerInformationContainer.contactFirstName}
          disabled={isLoading}
        />
      </Row>
      <Row label={employerInformation.contactLastName.label}>
        <FormTextField
          name={employerInformation.contactLastName.key}
          control={control}
          data-testid={dataTestIds.employerInformationContainer.contactLastName}
          disabled={isLoading}
        />
      </Row>
      <Row label={employerInformation.contactTitle.label}>
        <FormTextField
          name={employerInformation.contactTitle.key}
          control={control}
          data-testid={dataTestIds.employerInformationContainer.contactTitle}
          disabled={isLoading}
        />
      </Row>
      <Row label={employerInformation.contactEmail.label}>
        <FormTextField
          name={employerInformation.contactEmail.key}
          control={control}
          data-testid={dataTestIds.employerInformationContainer.contactEmail}
          rules={{
            validate: (value: string) => {
              if (!value) return true;
              return emailRegex.test(value) || 'Must be in the format "email@example.com"';
            },
          }}
          disabled={isLoading}
        />
      </Row>
      <Row label={employerInformation.contactPhone.label}>
        <FormTextField
          name={employerInformation.contactPhone.key}
          control={control}
          data-testid={dataTestIds.employerInformationContainer.contactPhone}
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
          }}
          disabled={isLoading}
        />
      </Row>
      <Row label={employerInformation.contactFax.label}>
        <FormTextField
          name={employerInformation.contactFax.key}
          control={control}
          data-testid={dataTestIds.employerInformationContainer.contactFax}
          inputProps={{ mask: '(000) 000-0000' }}
          InputProps={{
            inputComponent: InputMask as any,
          }}
          rules={{
            validate: (value: string) => {
              if (!value) return true;
              return (
                isPhoneNumberValid(value) ||
                'Fax number must be 10 digits in the format (xxx) xxx-xxxx and a valid number'
              );
            },
          }}
          disabled={isLoading}
        />
      </Row>
    </Section>
  );
};
