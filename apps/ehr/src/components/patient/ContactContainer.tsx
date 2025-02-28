import { Box } from '@mui/material';
import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { isPhoneNumberValid, patientFieldPaths, standardizePhoneNumber } from 'utils';
import { STATE_OPTIONS } from '../../constants';
import { FormAutocomplete, FormTextField } from '../form';
import { Row, Section } from '../layout';
import { getTelecomInfo, usePatientStore } from '../../state/patient.store';

export const ContactContainer: FC = () => {
  const { patient, updatePatientField } = usePatientStore();
  const { control } = useFormContext();

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
  };

  return (
    <Section title="Contact information">
      <Row label="Street address" inputId="patient-street-address" required>
        <FormTextField
          name={patientFieldPaths.streetAddress}
          control={control}
          defaultValue={patient?.address?.[0]?.line?.[0]}
          rules={{ required: true }}
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
            rules={{ required: true }}
            onChangeHandler={handleChange}
          />
          <FormAutocomplete
            name={patientFieldPaths.state}
            control={control}
            options={STATE_OPTIONS}
            defaultValue={patient?.address?.[0]?.state}
            rules={{
              validate: (value: string) => STATE_OPTIONS.some((option) => option.value === value),
              required: true,
            }}
            onChangeHandler={handleAutocompleteChange}
          />
          <FormTextField
            name={patientFieldPaths.zip}
            control={control}
            defaultValue={patient?.address?.[0]?.postalCode}
            rules={{ required: true }}
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
            required: true,
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Invalid email address',
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
            required: true,
            validate: (value: string) => isPhoneNumberValid(value),
          }}
          onChangeHandler={handleChange}
        />
      </Row>
    </Section>
  );
};
