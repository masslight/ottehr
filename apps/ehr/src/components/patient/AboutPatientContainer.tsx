import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { BasicDatePicker as DatePicker, FormSelect, FormTextField } from '../form';
import { PRONOUN_OPTIONS, SEX_OPTIONS } from '../../constants';
import { Row, Section } from '../layout';
import { dataTestIds } from '../../constants/data-test-ids';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';

const FormFields = {
  firstName: { key: 'patient-first-name', type: 'String' },
  middleName: { key: 'policy-holder-middle-name', type: 'String' },
  lastName: { key: 'patient-last-name', type: 'String' },
  suffix: { key: 'patient-suffix', type: 'String' },
  preferredName: { key: 'patient-preferred-name', type: 'String' },
  birthDate: { key: 'patient-birthdate', type: 'String' },
  birthSex: { key: 'patient-birth-sex', type: 'String' },
  pronouns: { key: 'patient-pronouns', type: 'String' },
};

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
          data-testid={dataTestIds.patientInformation.patientLastName}
        />
      </Row>
      <Row label="First name" inputId={FormFields.firstName.key} required>
        <FormTextField
          name={FormFields.firstName.key}
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          id={FormFields.firstName.key}
          data-testid={dataTestIds.patientInformation.patientFirstName}
        />
      </Row>
      <Row label="Middle name" inputId={FormFields.middleName.key}>
        <FormTextField name={FormFields.middleName.key} control={control} id={FormFields.middleName.key} />
      </Row>
      <Row label="Suffix" inputId={FormFields.suffix.key}>
        <FormTextField name={FormFields.suffix.key} control={control} id={FormFields.suffix.key} />
      </Row>
      <Row label="Preferred name" inputId={FormFields.preferredName.key}>
        <FormTextField name={FormFields.preferredName.key} control={control} id={FormFields.preferredName.key} />
      </Row>
      <Row label="Date of birth" inputId={FormFields.birthDate.key} required>
        <DatePicker
          id={FormFields.birthDate.key}
          name={FormFields.birthDate.key}
          control={control}
          required={true}
          onChange={(dateStr) => {
            console.log('dateStr', dateStr);
          }}
        />
      </Row>
      <Row label="Preferred pronouns">
        <FormSelect name={FormFields.pronouns.key} control={control} options={PRONOUN_OPTIONS} />
      </Row>
      <Row label="Birth sex" required>
        <FormSelect
          name={FormFields.birthSex.key}
          control={control}
          options={SEX_OPTIONS}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
          }}
          data-testid={dataTestIds.patientInformation.patientBirthSex}
        />
      </Row>
    </Section>
  );
};
