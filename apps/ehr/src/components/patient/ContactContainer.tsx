import { Box } from '@mui/material';
import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import {
  emailRegex,
  isPhoneNumberValid,
  isPostalCodeValid,
  patientFieldPaths,
  REQUIRED_FIELD_ERROR_MESSAGE,
  standardizePhoneNumber,
} from 'utils';
import { STATE_OPTIONS } from '../../constants';
import { FormAutocomplete, FormTextField } from '../form';
import { Row, Section } from '../layout';
import { usePatientStore } from '../../state/patient.store';

export const ContactContainer: FC = () => {
  const { patient, updatePatientField } = usePatientStore();
  const { control } = useFormContext();

  if (!patient) return null;

  const phone = patient?.telecom?.find((telecom) => telecom.system === 'phone')?.value;
  const phoneIndex = patient?.telecom?.findIndex((telecom) => telecom.system === 'phone' && telecom.value === phone);
  const phonePath = patientFieldPaths.phone.replace(/telecom\/\d+/, `telecom/${phoneIndex}`);

  const email = patient.telecom?.find((telecom) => telecom.system === 'email')?.value;
  const emailIndex = patient?.telecom?.findIndex((telecom) => telecom.system === 'email' && telecom.value === email);
  const emailPath = patientFieldPaths.email.replace(/telecom\/\d+/, `telecom/${emailIndex}`);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = event.target;
    updatePatientField(name, value);
  };

  const handleAutocompleteChange = (name: string, value: string): void => {
    handleChange({
      target: {
        name,
        value,
      },
    } as any);
  };

  return (
    <Section title="Contact information">
      <Row label="Street address" inputId="patient-street-address" required>
        <FormTextField
          name={patientFieldPaths.streetAddress}
          control={control}
          defaultValue={patient?.address?.[0]?.line?.[0]}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          id="patient-street-address"
          onChangeHandler={handleChange}
        />
      </Row>
      <Row label="City, State, ZIP" required>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormTextField
            name={patientFieldPaths.city}
            control={control}
            defaultValue={patient?.address?.[0]?.city}
            rules={{
              required: REQUIRED_FIELD_ERROR_MESSAGE,
              validate: (value: string) => isPostalCodeValid(value) || 'Must be 5 digits',
            }}
            onChangeHandler={handleChange}
          />
          <FormAutocomplete
            name={patientFieldPaths.state}
            control={control}
            options={STATE_OPTIONS}
            defaultValue={patient?.address?.[0]?.state}
            rules={{
              validate: (value: string) => STATE_OPTIONS.some((option) => option.value === value),
              required: REQUIRED_FIELD_ERROR_MESSAGE,
            }}
            onChangeHandler={handleAutocompleteChange}
          />
          <FormTextField
            name={patientFieldPaths.zip}
            control={control}
            defaultValue={patient?.address?.[0]?.postalCode}
            rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
            onChangeHandler={handleChange}
          />
        </Box>
      </Row>
      <Row label="Patient email" required={true}>
        <FormTextField
          id="patient-email"
          name={emailPath}
          control={control}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
            pattern: {
              value: emailRegex,
              message: 'Must be in the format "email@example.com"',
            },
          }}
          defaultValue={email}
          onChangeHandler={handleChange}
        />
      </Row>
      <Row label="Patient mobile" required={true}>
        <FormTextField
          id="patient-mobile"
          name={phonePath}
          control={control}
          defaultValue={standardizePhoneNumber(phone)}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
            validate: (value: string) => isPhoneNumberValid(value) || 'Must be 10 digits',
          }}
          onChangeHandler={handleChange}
        />
      </Row>
    </Section>
  );
};
