import { Autocomplete, Box, TextField } from '@mui/material';
import { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { emailRegex, isPhoneNumberValid, isPostalCodeValid, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import { STATE_OPTIONS } from '../../constants';
import { FormFields as AllFormFields } from '../../constants';
import { dataTestIds } from '../../constants/data-test-ids';
import { FormTextField } from '../form';
import InputMask from '../InputMask';
import { Row, Section } from '../layout';

const FormFields = AllFormFields.patientContactInformation;

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
        <FormTextField
          name={FormFields.addressLine2.key}
          control={control}
          id={FormFields.addressLine2.key}
          data-testid={dataTestIds.contactInformationContainer.addressLineOptional}
        />
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
            rules={{
              required: REQUIRED_FIELD_ERROR_MESSAGE,
            }}
            render={({ field: { value }, fieldState: { error } }) => {
              return (
                <Autocomplete
                  options={STATE_OPTIONS.map((option) => option.value)}
                  value={value ?? ''}
                  data-testid={dataTestIds.contactInformationContainer.state}
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
          inputProps={{ mask: '(000) 000-0000' }}
          InputProps={{
            inputComponent: InputMask as any,
          }}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
            validate: (value: string) =>
              isPhoneNumberValid(value) || 'Phone number must be 10 digits in the format (xxx) xxx-xxxx',
          }}
          data-testid={dataTestIds.contactInformationContainer.patientMobile}
        />
      </Row>
    </Section>
  );
};
