import { Autocomplete, Box, TextField } from '@mui/material';
import { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { FormSelect, FormTextField } from 'src/components/form';
import InputMask from 'src/components/InputMask';
import { Row, Section } from 'src/components/layout';
import { FormFields, PREFERRED_COMMUNICATION_METHOD_OPTIONS, STATE_OPTIONS } from 'src/constants';
import { dataTestIds } from 'src/constants/data-test-ids';
import { emailRegex, isPhoneNumberValid, isPostalCodeValid, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import inPersonIntakeQuestionnaire from '../../../../../../../../config/oystehr/in-person-intake-questionnaire.json';

const contact = FormFields.patientContactInformation;

export const ContactContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const { control, setValue } = useFormContext();

  const showPreferredCommunicationMethod =
    Object.values(inPersonIntakeQuestionnaire.fhirResources)[0]
      .resource.item.find((item) => item.linkId === 'contact-information-page')
      ?.item.find((item) => item.linkId === 'patient-preferred-communication-method') != null;

  return (
    <Section title="Contact information">
      <Row label="Street address" inputId={contact.streetAddress.key} required>
        <FormTextField
          name={contact.streetAddress.key}
          data-testid={dataTestIds.contactInformationContainer.streetAddress}
          control={control}
          disabled={isLoading}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          id={contact.streetAddress.key}
        />
      </Row>
      <Row label="Address line 2" inputId={contact.addressLine2.key}>
        <FormTextField
          name={contact.addressLine2.key}
          control={control}
          id={contact.addressLine2.key}
          disabled={isLoading}
          data-testid={dataTestIds.contactInformationContainer.addressLineOptional}
        />
      </Row>
      <Row label="City, State, ZIP" required>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormTextField
            name={contact.city.key}
            control={control}
            disabled={isLoading}
            rules={{
              required: REQUIRED_FIELD_ERROR_MESSAGE,
            }}
            data-testid={dataTestIds.contactInformationContainer.city}
          />
          <Controller
            name={contact.state.key}
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
                      setValue(contact.state.key, newValue);
                    } else {
                      setValue(contact.state.key, '');
                    }
                  }}
                  disableClearable
                  fullWidth
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      variant="standard"
                      error={!!error}
                      required
                      helperText={error?.message}
                      disabled={isLoading}
                    />
                  )}
                />
              );
            }}
          />
          <FormTextField
            name={contact.zip.key}
            control={control}
            disabled={isLoading}
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
          id={contact.email.key}
          name={contact.email.key}
          data-testid={dataTestIds.contactInformationContainer.patientEmail}
          control={control}
          disabled={isLoading}
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
          id={contact.phone.key}
          name={contact.phone.key}
          control={control}
          disabled={isLoading}
          inputProps={{ mask: '(000) 000-0000' }}
          InputProps={{
            inputComponent: InputMask as any,
          }}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
            validate: (value: string) =>
              isPhoneNumberValid(value) ||
              'Phone number must be 10 digits in the format (xxx) xxx-xxxx and a valid number',
          }}
          data-testid={dataTestIds.contactInformationContainer.patientMobile}
        />
      </Row>
      {showPreferredCommunicationMethod ? (
        <Row label="Preferred Communication Method" required={true}>
          <FormSelect
            name={contact.preferredCommunicationMethod.key}
            control={control}
            disabled={isLoading}
            options={PREFERRED_COMMUNICATION_METHOD_OPTIONS}
            rules={{
              required: REQUIRED_FIELD_ERROR_MESSAGE,
            }}
          />
        </Row>
      ) : null}
    </Section>
  );
};
