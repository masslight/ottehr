import { Autocomplete, Box, TextField } from '@mui/material';
import { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { emailRegex, isPhoneNumberValid, isPostalCodeValid, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import { STATE_OPTIONS } from '../../constants';
import { FormTextField } from '../form';
import { Row, Section } from '../layout';
import { dataTestIds } from '../../constants/data-test-ids';

const FormFields = {
  streetAddress: { key: 'patient-street-address', type: 'String' },
  addressLine2: { key: 'patient-street-address-2', type: 'String' },
  city: { key: 'patient-city', type: 'String' },
  state: { key: 'patient-state', type: 'String' },
  zip: { key: 'patient-zip', type: 'String' },
  email: { key: 'patient-email', type: 'String' },
  phone: { key: 'patient-number', type: 'String' },
};

export const PatientAddressFields = [
  FormFields.streetAddress.key,
  FormFields.addressLine2.key,
  FormFields.city.key,
  FormFields.state.key,
  FormFields.zip.key,
];

export const ContactContainer: FC = () => {
  const { control, setValue } = useFormContext();

  return (
    <Section title="Contact information">
      <Row label="Street address" inputId={FormFields.streetAddress.key} required>
        <FormTextField
          name={FormFields.streetAddress.key}
          data-testid={dataTestIds.contactInformationContainer.streetAddress}
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          id={FormFields.streetAddress.key}
        />
      </Row>
      <Row label="Address line 2" inputId={FormFields.addressLine2.key}>
        <FormTextField name={FormFields.addressLine2.key} control={control} id={FormFields.addressLine2.key} />
      </Row>
      <Row label="City, State, ZIP" required>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormTextField
            name={FormFields.city.key}
            control={control}
            rules={{
              required: REQUIRED_FIELD_ERROR_MESSAGE,
            }}
            data-testid={dataTestIds.contactInformationContainer.city}
          />
          <Controller
            name={FormFields.state.key}
            control={control}
            data-testid={dataTestIds.contactInformationContainer.state}
            rules={{
              required: REQUIRED_FIELD_ERROR_MESSAGE,
            }}
            render={({ field: { value }, fieldState: { error } }) => {
              return (
                <Autocomplete
                  options={STATE_OPTIONS.map((option) => option.value)}
                  value={value ?? ''}
                  onChange={(_, newValue) => {
                    if (newValue) {
                      setValue(FormFields.state.key, newValue);
                    } else {
                      setValue(FormFields.state.key, '');
                    }
                  }}
                  disableClearable
                  fullWidth
                  renderInput={(params) => (
                    <TextField {...params} variant="standard" error={!!error} required helperText={error?.message} />
                  )}
                />
              );
            }}
          />
          <FormTextField
            name={FormFields.zip.key}
            control={control}
            rules={{
              required: REQUIRED_FIELD_ERROR_MESSAGE,
              validate: (value: string) => isPostalCodeValid(value) || 'Must be 5 digits',
            }}
            data-testid={dataTestIds.contactInformationContainer.zip}
          />
        </Box>
      </Row>
      <Row label="Patient email" required={true}>
        <FormTextField
          id={FormFields.email.key}
          name={FormFields.email.key}
          data-testid={dataTestIds.contactInformationContainer.patientEmail}
          control={control}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
            pattern: {
              value: emailRegex,
              message: 'Must be in the format "email@example.com"',
            },
          }}
        />
      </Row>
      <Row label="Patient mobile" required={true}>
        <FormTextField
          id={FormFields.phone.key}
          name={FormFields.phone.key}
          control={control}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
            validate: (value: string) => isPhoneNumberValid(value) || 'Must be 10 digits',
          }}
          data-testid={dataTestIds.contactInformationContainer.patientMobile}
        />
      </Row>
    </Section>
  );
};
