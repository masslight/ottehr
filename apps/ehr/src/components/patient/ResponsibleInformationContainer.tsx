import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { phoneRegex, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import { BasicDatePicker as DatePicker, FormSelect, FormTextField } from '../../components/form';
import { RELATIONSHIP_OPTIONS, SEX_OPTIONS } from '../../constants';
import { Row, Section } from '../layout';
import { dataTestIds } from '../../constants/data-test-ids';
import InputMask from '../InputMask';

const FormFields = {
  relationship: { key: 'responsible-party-relationship', type: 'String', label: 'Relationship to the patient' },
  firstName: { key: 'responsible-party-first-name', type: 'String', label: 'First name' },
  lastName: { key: 'responsible-party-last-name', type: 'String', label: 'Last name' },
  birthDate: { key: 'responsible-party-date-of-birth', type: 'String', label: 'Date of birth' },
  birthSex: { key: 'responsible-party-birth-sex', type: 'String', label: 'Birth sex' },
  phone: { key: 'responsible-party-number', type: 'String', label: 'Phone' },
};
export const ResponsibleInformationContainer: FC = () => {
  const { control } = useFormContext();
  return (
    <Section title="Responsible party information" dataTestId={dataTestIds.responsiblePartyInformationContainer.id}>
      <Row label={FormFields.relationship.label} required>
        <FormSelect
          name={FormFields.relationship.key}
          data-testid={dataTestIds.responsiblePartyInformationContainer.relationshipDropdown}
          control={control}
          options={RELATIONSHIP_OPTIONS}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
            validate: (value: string) => RELATIONSHIP_OPTIONS.some((option) => option.value === value),
          }}
        />
      </Row>
      <Row label={FormFields.firstName.label} required inputId={FormFields.firstName.key}>
        <FormTextField
          name={FormFields.firstName.key}
          data-testid={dataTestIds.responsiblePartyInformationContainer.firstName}
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          id={FormFields.firstName.key}
        />
      </Row>
      <Row label={FormFields.lastName.label} required inputId={FormFields.lastName.key}>
        <FormTextField
          data-testid={dataTestIds.responsiblePartyInformationContainer.lastName}
          name={FormFields.lastName.key}
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          id={FormFields.lastName.key}
        />
      </Row>
      <Row label={FormFields.birthDate.label} required>
        <DatePicker name={FormFields.birthDate.key} control={control} required={true} defaultValue={''} />
      </Row>
      <Row label={FormFields.birthSex.label} required>
        <FormSelect
          name={FormFields.birthSex.key}
          data-testid={dataTestIds.responsiblePartyInformationContainer.birthSexDropdown}
          control={control}
          options={SEX_OPTIONS}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
          }}
          required={true}
        />
      </Row>
      <Row label={FormFields.phone.label} inputId={FormFields.phone.key}>
        <FormTextField
          id={FormFields.phone.key}
          name={FormFields.phone.key}
          data-testid={dataTestIds.responsiblePartyInformationContainer.phoneInput}
          control={control}
          inputProps={{ mask: '(000) 000-0000' }}
          InputProps={{
            inputComponent: InputMask as any,
          }}
          rules={{
            validate: (value: string) => {
              if (!value) return true;
              return phoneRegex.test(value) || 'Phone number must be 10 digits in the format (xxx) xxx-xxxx';
            },
          }}
        />
      </Row>
    </Section>
  );
};
