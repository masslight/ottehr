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
import { getTelecomInfo, usePatientStore } from '../../state/patient.store';
import { FormAutocomplete, FormTextField } from '../form';
import { Row, Section } from '../layout';
import { dataTestIds } from '../../constants/data-test-ids';

export const ContactContainer: FC = () => {
  const { patient, updatePatientField } = usePatientStore();
  const { control, trigger } = useFormContext();

  if (!patient) return null;

  const { value: phone, path: phonePath } = getTelecomInfo(patient, 'phone', 0);
  const { value: email, path: emailPath } = getTelecomInfo(patient, 'email', 1);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = event.target;
    const fieldType = name === emailPath ? 'email' : name === phonePath ? 'phone' : undefined;
    updatePatientField(name, value, undefined, fieldType);
  };

  const handleAutocompleteChange = (name: string, value: string): void => {
    updatePatientField(name, value);
    void trigger(name);
  };

  return (
    <Section title="Contact information">
      <Row label="Street address" inputId="patient-street-address" required>
        <FormTextField
          data-testid={dataTestIds.contactInformationContainer.streetAddress}
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
            }}
            onChangeHandler={handleChange}
            data-testid={dataTestIds.contactInformationContainer.city}
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
            data-testid={dataTestIds.contactInformationContainer.state}
          />
          <FormTextField
            name={patientFieldPaths.zip}
            control={control}
            defaultValue={patient?.address?.[0]?.postalCode}
            rules={{
              required: REQUIRED_FIELD_ERROR_MESSAGE,
              validate: (value: string) => isPostalCodeValid(value) || 'Must be 5 digits',
            }}
            onChangeHandler={handleChange}
            data-testid={dataTestIds.contactInformationContainer.zip}
          />
        </Box>
      </Row>
      <Row label="Patient email" required={true}>
        <FormTextField
          data-testid={dataTestIds.contactInformationContainer.patientEmail}
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
          data-testid={dataTestIds.contactInformationContainer.patientMobile}
        />
      </Row>
    </Section>
  );
};
