import { Box } from '@mui/material';
import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { patientFieldPaths, standardizePhoneNumber } from 'utils';
import { STATE_OPTIONS } from '../../constants';
import { FormAutocomplete, FormTextField } from '../form';
import { Row, Section } from '../layout';
import { usePatientStore } from '../../state/patient.store';
import { dataTestIds } from '../../constants/data-test-ids';

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
          data-testid={dataTestIds.contactInformationContainer.streetAddress}
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
            data-testid={dataTestIds.contactInformationContainer.city}
          />
          <FormAutocomplete
            name={patientFieldPaths.state}
            control={control}
            options={STATE_OPTIONS}
            defaultValue={patient?.address?.[0]?.state}
            rules={{
              validate: (value: string) => STATE_OPTIONS.some((option) => option.value === value),
              require: true,
            }}
            onChangeHandler={handleAutocompleteChange}
            data-testid={dataTestIds.contactInformationContainer.state}
          />
          <FormTextField
            name={patientFieldPaths.zip}
            control={control}
            defaultValue={patient?.address?.[0]?.postalCode}
            rules={{ required: true }}
            onChangeHandler={handleChange}
            data-testid={dataTestIds.contactInformationContainer.zip}
          />
        </Box>
      </Row>
      <Row label="Patient email">
        <FormTextField
          data-testid={dataTestIds.contactInformationContainer.patientEmail}
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
          }}
          onChangeHandler={handleChange}
          data-testid={dataTestIds.contactInformationContainer.patientMobile}
        />
      </Row>
    </Section>
  );
};
