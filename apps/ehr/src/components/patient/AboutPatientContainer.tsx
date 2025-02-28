import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { BasicDatePicker as DatePicker, FormSelect, FormTextField } from '../form';
import { PRONOUN_OPTIONS, SEX_OPTIONS } from '../../constants';
import { Row, Section } from '../layout';
import { usePatientStore } from '../../state/patient.store';
import { getPronounsFromExtension } from '../../helpers/fhir';
import { dataTestIds } from '../../constants/data-test-ids';
import { patientFieldPaths, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';

export const AboutPatientContainer: FC = () => {
  const { patient, updatePatientField } = usePatientStore();
  const { control } = useFormContext();

  if (!patient) return null;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = event.target;
    updatePatientField(name, value);
  };

  return (
    <Section title="Patient information">
      <Row label="Last name" inputId="patient-last-name" required>
        <FormTextField
          name={patientFieldPaths.lastName}
          control={control}
          defaultValue={patient?.name?.[0]?.family}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          id="patient-last-name"
          onChangeHandler={handleChange}
          data-testid={dataTestIds.patientInformation.patientLastName}
        />
      </Row>
      <Row label="First name" inputId="patient-first-name" required>
        <FormTextField
          name={patientFieldPaths.firstName}
          control={control}
          defaultValue={patient?.name?.[0]?.given?.[0]}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          id="patient-first-name"
          onChangeHandler={handleChange}
          data-testid={dataTestIds.patientInformation.patientFirstName}
        />
      </Row>
      <Row label="Middle name" inputId="patient-middle-name">
        <FormTextField
          name={patientFieldPaths.middleName}
          control={control}
          defaultValue={patient?.name?.[0]?.given?.[1]}
          id="patient-middle-name"
          onChangeHandler={handleChange}
        />
      </Row>
      <Row label="Suffix" inputId="patient-suffix">
        <FormTextField
          name={patientFieldPaths.suffix}
          control={control}
          defaultValue={patient?.name?.[0]?.suffix?.[0]}
          id="patient-suffix"
          onChangeHandler={handleChange}
        />
      </Row>
      <Row label="Preffered name" inputId="patient-preffered-name">
        <FormTextField
          name={patientFieldPaths.preferredName}
          control={control}
          defaultValue={patient?.name?.[1]?.given?.[0]}
          id="patient-preffered-name"
          onChangeHandler={handleChange}
        />
      </Row>
      <Row label="Date of birth" inputId="patient-date-of-birth" required>
        <DatePicker
          id="patient-date-of-birth"
          name={patientFieldPaths.birthDate}
          control={control}
          required={true}
          defaultValue={patient?.birthDate}
          onChange={(dateStr) => {
            updatePatientField(patientFieldPaths.birthDate, dateStr);
          }}
        />
      </Row>
      <Row label="Preferred pronouns">
        <FormSelect
          name={patientFieldPaths.preferredPronouns}
          control={control}
          options={PRONOUN_OPTIONS}
          defaultValue={patient ? getPronounsFromExtension(patient) : ''}
          onChangeHandler={handleChange}
        />
      </Row>
      <Row label="Birth sex" required>
        <FormSelect
          name={patientFieldPaths.gender}
          control={control}
          options={SEX_OPTIONS}
          defaultValue={patient?.gender}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
          }}
          onChangeHandler={handleChange}
          data-testid={dataTestIds.patientInformation.patientBirthSex}
        />
      </Row>
    </Section>
  );
};
