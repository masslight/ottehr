import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { FormSelect, FormTextField } from 'src/components/form';
import { BasicDatePicker } from 'src/components/form/DatePicker';
import { Row, Section } from 'src/components/layout';
import { FormFields, PRONOUN_OPTIONS, SEX_OPTIONS } from 'src/constants';
import { dataTestIds } from 'src/constants/data-test-ids';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';

const { patientSummary } = FormFields;

export const AboutPatientContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const { control } = useFormContext();

  return (
    <Section title="Patient information">
      <Row label="Last name" inputId={patientSummary.lastName.key} required>
        <FormTextField
          name={patientSummary.lastName.key}
          control={control}
          disabled={isLoading}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          id={patientSummary.lastName.key}
          data-testid={dataTestIds.patientInformationContainer.patientLastName}
        />
      </Row>
      <Row label="First name" inputId={patientSummary.firstName.key} required>
        <FormTextField
          name={patientSummary.firstName.key}
          control={control}
          disabled={isLoading}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          id={patientSummary.firstName.key}
          data-testid={dataTestIds.patientInformationContainer.patientFirstName}
        />
      </Row>
      <Row label="Middle name" inputId={patientSummary.middleName.key}>
        <FormTextField
          name={patientSummary.middleName.key}
          control={control}
          disabled={isLoading}
          id={patientSummary.middleName.key}
          data-testid={dataTestIds.patientInformationContainer.patientMiddleName}
        />
      </Row>
      <Row label="Suffix" inputId={patientSummary.suffix.key}>
        <FormTextField
          name={patientSummary.suffix.key}
          control={control}
          disabled={isLoading}
          id={patientSummary.suffix.key}
          data-testid={dataTestIds.patientInformationContainer.patientSuffix}
        />
      </Row>
      <Row label="Preferred name" inputId={patientSummary.preferredName.key}>
        <FormTextField
          name={patientSummary.preferredName.key}
          control={control}
          disabled={isLoading}
          id={patientSummary.preferredName.key}
          data-testid={dataTestIds.patientInformationContainer.patientPreferredName}
        />
      </Row>
      <Row label="Date of birth" inputId={patientSummary.birthDate.key} required>
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
      <Row label="Preferred pronouns">
        <FormSelect
          name={patientSummary.pronouns.key}
          control={control}
          options={PRONOUN_OPTIONS}
          disabled={isLoading}
          data-testid={dataTestIds.patientInformationContainer.patientPreferredPronouns}
        />
      </Row>
      <Row label="Birth sex" required>
        <FormSelect
          name={patientSummary.birthSex.key}
          control={control}
          disabled={isLoading}
          options={SEX_OPTIONS}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
          }}
          data-testid={dataTestIds.patientInformationContainer.patientBirthSex}
        />
      </Row>
    </Section>
  );
};
