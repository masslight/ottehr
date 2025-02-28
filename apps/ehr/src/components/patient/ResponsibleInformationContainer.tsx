import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { isPhoneNumberValid, patientFieldPaths, standardizePhoneNumber } from 'utils';
import { BasicDatePicker as DatePicker, FormSelect, FormTextField } from '../../components/form';
import { RELATIONSHIP_OPTIONS, SEX_OPTIONS } from '../../constants';
import { Row, Section } from '../layout';
import { usePatientStore } from '../../state/patient.store';

export const ResponsibleInformationContainer: FC = () => {
  const { patient, updatePatientField } = usePatientStore();

  const { control, setValue } = useFormContext();

  if (!patient) return null;

  const contactIndex = patient.contact?.findIndex(
    (contact) =>
      contact.relationship?.some(
        (rel) =>
          rel.coding?.some(
            (code) => code.system === 'http://terminology.hl7.org/CodeSystem/v2-0131' && code.code === 'BP'
          )
      )
  );

  const responsiblePartyIndex = patient?.contact ? (contactIndex === -1 ? patient.contact.length : contactIndex) : 0;

  const responsiblePartyContact = responsiblePartyIndex ? patient?.contact?.[responsiblePartyIndex] : undefined;

  const responsiblePartyFullNamePath = patientFieldPaths.responsiblePartyName.replace(
    /contact\/\d+/,
    `contact/${responsiblePartyIndex}`
  );

  const responsiblePartyFirstNamePath = patientFieldPaths.responsiblePartyFirstName.replace(
    /contact\/\d+/,
    `contact/${responsiblePartyIndex}`
  );

  const responsiblePartyLastNamePath = patientFieldPaths.responsiblePartyLastName.replace(
    /contact\/\d+/,
    `contact/${responsiblePartyIndex}`
  );

  const responsiblePartyRelationshipPath = patientFieldPaths.responsiblePartyRelationship.replace(
    /contact\/\d+/,
    `contact/${responsiblePartyIndex}`
  );

  const responsiblePartyBirthDatePath = patientFieldPaths.responsiblePartyBirthDate.replace(
    /contact\/\d+/,
    `contact/${responsiblePartyIndex}`
  );

  const responsiblePartyGenderPath = patientFieldPaths.responsiblePartyGender.replace(
    /contact\/\d+/,
    `contact/${responsiblePartyIndex}`
  );

  const relationship = responsiblePartyContact?.relationship?.find(
    (rel) => rel.coding?.some((coding) => coding.system === 'http://hl7.org/fhir/relationship')
  )?.coding?.[0].display;

  const fullName =
    responsiblePartyContact?.name?.family && responsiblePartyContact?.name?.given?.[0]
      ? `${responsiblePartyContact.name.family}, ${responsiblePartyContact.name.given[0]}`
      : '';

  const birthDate = responsiblePartyContact?.extension?.[0].valueString;

  const birthSex = responsiblePartyContact?.gender;

  const phoneNumberIndex = responsiblePartyContact?.telecom
    ? responsiblePartyContact?.telecom?.findIndex((telecom) => telecom.system === 'phone')
    : -1;

  const phone = responsiblePartyContact?.telecom?.[phoneNumberIndex]?.value;

  const responsiblePartyPhonePath = patientFieldPaths.responsiblePartyPhone
    .replace(/contact\/\d+/, `contact/${responsiblePartyIndex}`)
    .replace(/telecom\/\d+/, `telecom/${phoneNumberIndex}`);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = event.target;
    updatePatientField(name, value);
  };

  const handleResponsiblePartyNameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;

    // Auto-format: If there's a space between words but no comma, add the comma
    const formattedValue = value.includes(',')
      ? value
      : value.replace(/(\w+)\s+(\w+)/, (_, lastName, firstName) => `${lastName}, ${firstName}`);
    // Update the input value with formatted version
    setValue(patientFieldPaths.responsiblePartyName, formattedValue);
    const [lastName = '', firstName = ''] = formattedValue.split(',').map((part) => part.trim());

    // Update both name parts
    handleChange({
      target: {
        name: responsiblePartyLastNamePath,
        value: lastName,
      },
    } as any);

    handleChange({
      target: {
        name: responsiblePartyFirstNamePath,
        value: firstName,
      },
    } as any);
  };

  return (
    <Section title="Responsible party information">
      <Row label="Relationship" required>
        <FormSelect
          name={responsiblePartyRelationshipPath}
          control={control}
          options={RELATIONSHIP_OPTIONS}
          rules={{
            required: true,
            validate: (value: string) => RELATIONSHIP_OPTIONS.some((option) => option.value === value),
          }}
          defaultValue={RELATIONSHIP_OPTIONS.find((option) => option.value === relationship)?.value}
          onChangeHandler={handleChange}
        />
      </Row>
      <Row label="Full name" required inputId="responsible-party-full-name">
        <FormTextField
          name={responsiblePartyFullNamePath}
          control={control}
          defaultValue={fullName}
          rules={{ required: true }}
          onChangeHandler={handleResponsiblePartyNameChange}
          id="responsible-party-full-name"
        />
      </Row>
      <Row label="Date of birth" required>
        <DatePicker
          name={responsiblePartyBirthDatePath}
          control={control}
          required={true}
          defaultValue={birthDate}
          onChange={(dateStr) => {
            updatePatientField(responsiblePartyBirthDatePath, dateStr);
          }}
        />
      </Row>
      <Row label="Birth sex" required>
        <FormSelect
          name={responsiblePartyGenderPath}
          control={control}
          options={SEX_OPTIONS}
          required={true}
          defaultValue={birthSex}
          onChangeHandler={handleChange}
        />
      </Row>
      <Row label="Phone" required inputId="responsible-party-phone">
        <FormTextField
          id="responsible-party-phone"
          name={responsiblePartyPhonePath}
          control={control}
          defaultValue={standardizePhoneNumber(phone)}
          rules={{
            required: true,
            validate: (value: string) => isPhoneNumberValid(value) || 'Must be 10 digits',
          }}
          onChangeHandler={handleChange}
        />
      </Row>
    </Section>
  );
};
