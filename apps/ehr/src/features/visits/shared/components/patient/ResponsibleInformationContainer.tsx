import { Autocomplete, Box, TextField } from '@mui/material';
import { DateTime } from 'luxon';
import { FC, useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { FormSelect, FormTextField } from 'src/components/form';
import { BasicDatePicker } from 'src/components/form/DatePicker';
import InputMask from 'src/components/InputMask';
import { Row, Section } from 'src/components/layout';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  DOB_DATE_FORMAT,
  emailRegex,
  isPhoneNumberValid,
  isPostalCodeValid,
  PATIENT_RECORD_CONFIG,
  REQUIRED_FIELD_ERROR_MESSAGE,
} from 'utils';

const { responsibleParty, patientSummary, patientContactInformation } = PATIENT_RECORD_CONFIG.FormFields;

export const ResponsibleInformationContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const { control, watch, getValues, setValue } = useFormContext();

  const selfSelected = watch(responsibleParty.relationship.key) === 'Self';

  useEffect(() => {
    const fieldMap = {
      [responsibleParty.firstName.key]: patientSummary.firstName.key,
      [responsibleParty.lastName.key]: patientSummary.lastName.key,
      [responsibleParty.birthDate.key]: patientSummary.birthDate.key,
      [responsibleParty.birthSex.key]: patientSummary.birthSex.key,
      [responsibleParty.phone.key]: patientContactInformation.phone.key,
      [responsibleParty.email.key]: patientContactInformation.email.key,
      [responsibleParty.addressLine1.key]: patientContactInformation.streetAddress.key,
      [responsibleParty.addressLine2.key]: patientContactInformation.addressLine2.key,
      [responsibleParty.city.key]: patientContactInformation.city.key,
      [responsibleParty.state.key]: patientContactInformation.state.key,
      [responsibleParty.zip.key]: patientContactInformation.zip.key,
    };

    if (selfSelected) {
      Object.entries(fieldMap).forEach(([responsiblePartyKey, patientKey]) => {
        const patientValue = getValues(patientKey);
        const responsiblePartyValue = getValues(responsiblePartyKey);

        if (patientValue !== responsiblePartyValue) {
          setValue(responsiblePartyKey, patientValue);
        }
      });
    }

    const subscription = watch((_, { name }) => {
      if (!selfSelected || !name) return;

      const matched = Object.entries(fieldMap).find(([, patientKey]) => patientKey === name);

      if (matched) {
        const [responsiblePartyKey, patientKey] = matched;
        const patientValue = getValues(patientKey);
        const responsiblePartyValue = getValues(responsiblePartyKey);

        if (patientValue !== responsiblePartyValue) {
          setValue(responsiblePartyKey, patientValue);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [selfSelected, watch, setValue, getValues]);

  return (
    <Section title="Responsible party information" dataTestId={dataTestIds.responsiblePartyInformationContainer.id}>
      <Row
        label={responsibleParty.relationship.label}
        dataTestId={dataTestIds.responsiblePartyInformationContainer.relationshipDropdown}
        required
      >
        <FormSelect
          name={responsibleParty.relationship.key}
          control={control}
          disabled={isLoading}
          options={PATIENT_RECORD_CONFIG.formValueSets.relationshipOptions}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
            validate: (value: string) =>
              PATIENT_RECORD_CONFIG.formValueSets.relationshipOptions.some((option) => option.value === value),
          }}
        />
      </Row>
      <Row label={responsibleParty.firstName.label} required inputId={responsibleParty.firstName.key}>
        <FormTextField
          name={responsibleParty.firstName.key}
          data-testid={dataTestIds.responsiblePartyInformationContainer.firstName}
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          id={responsibleParty.firstName.key}
          disabled={selfSelected || isLoading}
        />
      </Row>
      <Row label={responsibleParty.lastName.label} required inputId={responsibleParty.lastName.key}>
        <FormTextField
          data-testid={dataTestIds.responsiblePartyInformationContainer.lastName}
          name={responsibleParty.lastName.key}
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          id={responsibleParty.lastName.key}
          disabled={selfSelected || isLoading}
        />
      </Row>
      <Row label={responsibleParty.birthDate.label} required>
        <BasicDatePicker
          name={responsibleParty.birthDate.key}
          control={control}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
            validate: (value: string) => {
              if (!value) return true;
              const bdDateTime = DateTime.fromFormat(value, DOB_DATE_FORMAT);
              return bdDateTime.isValid || 'Date is invalid';
            },
          }}
          defaultValue={''}
          disabled={selfSelected || isLoading}
          dataTestId={dataTestIds.responsiblePartyInformationContainer.dateOfBirthDropdown}
          component="Field"
        />
      </Row>
      <Row
        label={responsibleParty.birthSex.label}
        dataTestId={dataTestIds.responsiblePartyInformationContainer.birthSexDropdown}
        required
      >
        <FormSelect
          name={responsibleParty.birthSex.key}
          control={control}
          options={PATIENT_RECORD_CONFIG.formValueSets.birthSexOptions}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
          }}
          required={true}
          disabled={selfSelected || isLoading}
        />
      </Row>
      <Row label={responsibleParty.phone.label} inputId={responsibleParty.phone.key}>
        <FormTextField
          id={responsibleParty.phone.key}
          name={responsibleParty.phone.key}
          data-testid={dataTestIds.responsiblePartyInformationContainer.phoneInput}
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
          }}
          disabled={selfSelected || isLoading}
        />
      </Row>
      <Row label={responsibleParty.email.label} inputId={responsibleParty.email.key} required>
        <FormTextField
          id={responsibleParty.email.key}
          name={responsibleParty.email.key}
          data-testid={dataTestIds.responsiblePartyInformationContainer.emailInput}
          control={control}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
            pattern: {
              value: emailRegex,
              message: 'Must be in the format "email@example.com"',
            },
          }}
          required={true}
          disabled={selfSelected || isLoading}
        />
      </Row>
      <Row label={responsibleParty.addressLine1.label} required inputId={responsibleParty.addressLine1.key}>
        <FormTextField
          data-testid={dataTestIds.responsiblePartyInformationContainer.addressLine1}
          name={responsibleParty.addressLine1.key}
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          id={responsibleParty.addressLine1.key}
          disabled={selfSelected || isLoading}
        />
      </Row>
      <Row label={responsibleParty.addressLine2.label} inputId={responsibleParty.addressLine2.key}>
        <FormTextField
          data-testid={dataTestIds.responsiblePartyInformationContainer.addressLine2}
          name={responsibleParty.addressLine2.key}
          control={control}
          id={responsibleParty.addressLine2.key}
          disabled={selfSelected || isLoading}
        />
      </Row>
      <Row label="City, State, ZIP" required>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormTextField
            name={responsibleParty.city.key}
            control={control}
            rules={{
              required: REQUIRED_FIELD_ERROR_MESSAGE,
            }}
            data-testid={dataTestIds.responsiblePartyInformationContainer.city}
            disabled={selfSelected || isLoading}
          />
          <Controller
            name={responsibleParty.state.key}
            control={control}
            rules={{
              required: REQUIRED_FIELD_ERROR_MESSAGE,
            }}
            render={({ field: { value }, fieldState: { error } }) => {
              return (
                <Autocomplete
                  options={PATIENT_RECORD_CONFIG.formValueSets.stateOptions.map((option) => option.value)}
                  value={value ?? ''}
                  data-testid={dataTestIds.responsiblePartyInformationContainer.state}
                  onChange={(_, newValue) => {
                    if (newValue) {
                      setValue(responsibleParty.state.key, newValue);
                    } else {
                      setValue(responsibleParty.state.key, '');
                    }
                  }}
                  disableClearable
                  fullWidth
                  renderInput={(params) => (
                    <TextField {...params} variant="standard" error={!!error} required helperText={error?.message} />
                  )}
                  disabled={selfSelected || isLoading}
                />
              );
            }}
          />
          <FormTextField
            name={responsibleParty.zip.key}
            control={control}
            rules={{
              required: REQUIRED_FIELD_ERROR_MESSAGE,
              validate: (value: string) => isPostalCodeValid(value) || 'Must be 5 digits',
            }}
            data-testid={dataTestIds.responsiblePartyInformationContainer.zip}
            disabled={selfSelected || isLoading}
          />
        </Box>
      </Row>
    </Section>
  );
};
