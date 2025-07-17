import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import { PRONOUN_OPTIONS, SEX_OPTIONS } from '../../constants';
import { FormFields as AllFormFields } from '../../constants';
import { dataTestIds } from '../../constants/data-test-ids';
import { BasicDatePicker as DatePicker, FormSelect, FormTextField } from '../form';
import { Row, Section } from '../layout';

const FormFields = AllFormFields.patientSummary;

export const AboutPatientContainer: FC = () => {
  const { control } = useFormContext();

  return (
    <Section title="Patient information">
      <Row label="Last name" inputId={FormFields.lastName.key} required>
        <FormTextField
          name={FormFields.lastName.key}
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          id={FormFields.lastName.key}
          data-testid={dataTestIds.patientInformationContainer.patientLastName}
        />
      </Row>
      <Row label="First name" inputId={FormFields.firstName.key} required>
        <FormTextField
          name={FormFields.firstName.key}
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          id={FormFields.firstName.key}
          data-testid={dataTestIds.patientInformationContainer.patientFirstName}
        />
      </Row>
      <Row label="Middle name" inputId={FormFields.middleName.key}>
        <FormTextField
          name={FormFields.middleName.key}
          control={control}
          id={FormFields.middleName.key}
          data-testid={dataTestIds.patientInformationContainer.patientMiddleName}
        />
      </Row>
      <Row label="Suffix" inputId={FormFields.suffix.key}>
        <FormTextField
          name={FormFields.suffix.key}
          control={control}
          id={FormFields.suffix.key}
          data-testid={dataTestIds.patientInformationContainer.patientSuffix}
        />
      </Row>
      <Row label="Preferred name" inputId={FormFields.preferredName.key}>
        <FormTextField
          name={FormFields.preferredName.key}
          control={control}
          id={FormFields.preferredName.key}
          data-testid={dataTestIds.patientInformationContainer.patientPreferredName}
        />
      </Row>
      <Row label="Date of birth" inputId={FormFields.birthDate.key} required>
        <DatePicker
          id={FormFields.birthDate.key}
          name={FormFields.birthDate.key}
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          dataTestId={dataTestIds.patientInformationContainer.patientDateOfBirth}
          component="Field"
        />
      </Row>
      <Row label="Preferred pronouns">
        <FormSelect
          name={FormFields.pronouns.key}
          control={control}
          options={PRONOUN_OPTIONS}
          data-testid={dataTestIds.patientInformationContainer.patientPreferredPronouns}
        />
      </Row>
      <Row label="Birth sex" required>
        <FormSelect
          name={FormFields.birthSex.key}
          control={control}
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
