import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { patientFieldPaths, standardizePhoneNumber } from 'utils';
import { BasicDatePicker as DatePicker, FormSelect, FormTextField } from '../../components/form';
import { RELATIONSHIP_OPTIONS, SEX_OPTIONS } from '../../constants';
import { Row, Section } from '../layout';
import { usePatientStore } from '../../state/patient.store';
import { dataTestIds } from '../../constants/data-test-ids';

export const ResponsibleInformationContainer: FC = () => {
  const { patient, updatePatientField } = usePatientStore();

  const { control } = useFormContext();

  if (!patient) return null;

  const phone = patient?.contact?.[0].telecom?.find((telecom) => telecom.system === 'phone')?.value;
  const index = patient?.contact?.[0].telecom?.findIndex(
    (telecom) => telecom.system === 'phone' && telecom.value === phone
  );
  const responsiblePartyPhonePath = patientFieldPaths.responsiblePartyPhone.replace(/telecom\/\d+/, `telecom/${index}`);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = event.target;
    updatePatientField(name, value);
  };

  const handleResponsiblePartyNameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;

    const [lastName = '', firstName = ''] = value.split(',').map((part) => part.trim());

    // Update both name parts
    handleChange({
      target: {
        name: patientFieldPaths.responsiblePartyLastName,
        value: lastName,
      },
    } as any);

    handleChange({
      target: {
        name: patientFieldPaths.responsiblePartyFirstName,
        value: firstName,
      },
    } as any);
  };

  return (
    <Section title="Responsible party information">
      <Row label="Relationship" required>
        <FormSelect
          data-testid={dataTestIds.responsiblePartyInformationContainer.relationshipDropdown}
          name={patientFieldPaths.responsiblePartyRelationship}
          control={control}
          options={RELATIONSHIP_OPTIONS}
          rules={{
            required: true,
            validate: (value: string) => RELATIONSHIP_OPTIONS.some((option) => option.value === value),
          }}
          defaultValue={
            RELATIONSHIP_OPTIONS.find(
              (option) => option.value === patient?.contact?.[0]?.relationship?.[0]?.coding?.[0]?.display
            )?.value
          }
          onChangeHandler={handleChange}
        />
      </Row>
      <Row label="Full name" required inputId="responsible-party-full-name">
        <FormTextField
          data-testid={dataTestIds.responsiblePartyInformationContainer.fullName}
          name={patientFieldPaths.responsiblePartyName}
          control={control}
          defaultValue={`${patient?.contact?.[0].name?.family}, ${patient?.contact?.[0].name?.given?.[0]}`}
          rules={{ required: true }}
          onChangeHandler={handleResponsiblePartyNameChange}
          id="responsible-party-full-name"
        />
      </Row>
      <Row label="Date of birth" required>
        <DatePicker
          name={patientFieldPaths.responsiblePartyBirthDate}
          control={control}
          required={true}
          defaultValue={patient?.contact?.[0].extension?.[0].valueString}
          onChange={(dateStr) => {
            updatePatientField(patientFieldPaths.responsiblePartyBirthDate, dateStr);
          }}
        />
      </Row>
      <Row label="Birth sex" required>
        <FormSelect
          data-testid={dataTestIds.responsiblePartyInformationContainer.birthSexDropdown}
          name={patientFieldPaths.responsiblePartyGender}
          control={control}
          options={SEX_OPTIONS}
          required={true}
          defaultValue={patient?.contact?.[0].gender}
          onChangeHandler={handleChange}
        />
      </Row>
      <Row label="Phone" required inputId="responsible-party-phone">
        <FormTextField
          data-testid={dataTestIds.responsiblePartyInformationContainer.phoneInput}
          id="responsible-party-phone"
          name={responsiblePartyPhonePath}
          control={control}
          defaultValue={standardizePhoneNumber(phone)}
          rules={{
            required: true,
          }}
          onChangeHandler={handleChange}
        />
      </Row>
    </Section>
  );
};
