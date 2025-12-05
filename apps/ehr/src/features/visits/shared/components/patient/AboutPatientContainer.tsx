import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { FormSelect, FormTextField } from 'src/components/form';
import { BasicDatePicker } from 'src/components/form/DatePicker';
import { Row, Section } from 'src/components/layout';
import { dataTestIds } from 'src/constants/data-test-ids';
import { PATIENT_RECORD_CONFIG, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';

const { patientSummary } = PATIENT_RECORD_CONFIG.FormFields;

export const AboutPatientContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const { control } = useFormContext();

  return (
    <Section title="Patient information">
      <Row label={patientSummary.lastName.label} inputId={patientSummary.lastName.key} required>
        <FormTextField
          name={patientSummary.lastName.key}
          control={control}
          disabled={isLoading}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          id={patientSummary.lastName.key}
          data-testid={dataTestIds.patientInformationContainer.patientLastName}
        />
      </Row>
      <Row label={patientSummary.firstName.label} inputId={patientSummary.firstName.key} required>
        <FormTextField
          name={patientSummary.firstName.key}
          control={control}
          disabled={isLoading}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          id={patientSummary.firstName.key}
          data-testid={dataTestIds.patientInformationContainer.patientFirstName}
        />
      </Row>
      <Row label={patientSummary.middleName.label} inputId={patientSummary.middleName.key}>
        <FormTextField
          name={patientSummary.middleName.key}
          control={control}
          disabled={isLoading}
          id={patientSummary.middleName.key}
          data-testid={dataTestIds.patientInformationContainer.patientMiddleName}
        />
      </Row>
      <Row label={patientSummary.suffix.label} inputId={patientSummary.suffix.key}>
        <FormTextField
          name={patientSummary.suffix.key}
          control={control}
          disabled={isLoading}
          id={patientSummary.suffix.key}
          data-testid={dataTestIds.patientInformationContainer.patientSuffix}
        />
      </Row>
      <Row label={patientSummary.preferredName.label} inputId={patientSummary.preferredName.key}>
        <FormTextField
          name={patientSummary.preferredName.key}
          control={control}
          disabled={isLoading}
          id={patientSummary.preferredName.key}
          data-testid={dataTestIds.patientInformationContainer.patientPreferredName}
        />
      </Row>
      <Row label={patientSummary.birthDate.label} inputId={patientSummary.birthDate.key} required>
        <BasicDatePicker
          id={patientSummary.birthDate.key}
          name={patientSummary.birthDate.key}
          control={control}
          disabled={isLoading}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          dataTestId={dataTestIds.patientInformationContainer.patientDateOfBirth}
          component="Field"
        />
      </Row>
      <Row label={patientSummary.pronouns.label}>
        <FormSelect
          name={patientSummary.pronouns.key}
          control={control}
          options={PATIENT_RECORD_CONFIG.formValueSets.pronounOptions}
          disabled={isLoading}
          data-testid={dataTestIds.patientInformationContainer.patientPreferredPronouns}
        />
      </Row>
      <Row label={patientSummary.birthSex.label} required>
        <FormSelect
          name={patientSummary.birthSex.key}
          control={control}
          disabled={isLoading}
          options={PATIENT_RECORD_CONFIG.formValueSets.birthSexOptions}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
          }}
          data-testid={dataTestIds.patientInformationContainer.patientBirthSex}
        />
      </Row>
      <Row label={patientSummary.ssn.label} inputId={patientSummary.ssn.key}>
        <FormTextField
          name={patientSummary.ssn.key}
          control={control}
          disabled={isLoading}
          id={patientSummary.ssn.key}
          data-testid={dataTestIds.patientInformationContainer.patientSSN}
        />
      </Row>
    </Section>
  );
};
