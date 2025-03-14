import { Box } from '@mui/material';
import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { emailRegex, isPhoneNumberValid, isPostalCodeValid, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import { STATE_OPTIONS } from '../../constants';
import { FormAutocomplete, FormTextField } from '../form';
import { Row, Section } from '../layout';

const FormFields = {
  streetAddress: { key: 'patient-street-address', type: 'String' },
  addressLine2: { key: 'patient-street-address-2', type: 'String' },
  city: { key: 'patient-city', type: 'String' },
  state: { key: 'patient-state', type: 'String' },
  zip: { key: 'patient-zip', type: 'String' },
  email: { key: 'patient-email', type: 'String' },
  phone: { key: 'patient-number', type: 'String' },
};

export const ContactContainer: FC = () => {
  const { control } = useFormContext();

  return (
    <Section title="Contact information">
      <Row label="Street address" inputId={FormFields.streetAddress.key} required>
        <FormTextField
          name={FormFields.streetAddress.key}
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          id={FormFields.streetAddress.key}
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
          />
          <FormAutocomplete
            name={FormFields.state.key}
            control={control}
            options={STATE_OPTIONS}
            rules={{
              validate: (value: string) => STATE_OPTIONS.some((option) => option.value === value),
              required: REQUIRED_FIELD_ERROR_MESSAGE,
            }}
          />
          <FormTextField
            name={FormFields.zip.key}
            control={control}
            rules={{
              required: REQUIRED_FIELD_ERROR_MESSAGE,
              validate: (value: string) => isPostalCodeValid(value) || 'Must be 5 digits',
            }}
          />
        </Box>
      </Row>
      <Row label="Patient email" required={true}>
        <FormTextField
          id={FormFields.email.key}
          name={FormFields.email.key}
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
        />
      </Row>
    </Section>
  );
};
