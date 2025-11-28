import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { FormSelect, FormTextField } from 'src/components/form';
import InputMask from 'src/components/InputMask';
import { Row, Section } from 'src/components/layout';
import { EMERGENCY_CONTACT_RELATIONSHIP_OPTIONS, FormFields as AllFormFields } from 'src/constants';
import { isPhoneNumberValid, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';

const FormFields = AllFormFields.emergencyContact;

export const EmergencyContactContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const { control } = useFormContext();

  return (
    <Section title="Emergency contact information">
      <Row label={FormFields.relationship.label} required>
        <FormSelect
          name={FormFields.relationship.key}
          control={control}
          options={EMERGENCY_CONTACT_RELATIONSHIP_OPTIONS}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
            validate: (value: string) =>
              EMERGENCY_CONTACT_RELATIONSHIP_OPTIONS.some((option) => option.value === value),
          }}
          id={FormFields.relationship.key}
          disabled={isLoading}
        />
      </Row>
      <Row label={FormFields.firstName.label} required inputId={FormFields.firstName.key}>
        <FormTextField
          name={FormFields.firstName.key}
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          id={FormFields.firstName.key}
          disabled={isLoading}
        />
      </Row>
      <Row label={FormFields.middleName.label} inputId={FormFields.middleName.key}>
        <FormTextField
          name={FormFields.middleName.key}
          control={control}
          id={FormFields.middleName.key}
          disabled={isLoading}
        />
      </Row>
      <Row label={FormFields.lastName.label} required inputId={FormFields.lastName.key}>
        <FormTextField
          name={FormFields.lastName.key}
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          id={FormFields.lastName.key}
          disabled={isLoading}
        />
      </Row>
      <Row label={FormFields.phone.label} required inputId={FormFields.phone.key}>
        <FormTextField
          id={FormFields.phone.key}
          name={FormFields.phone.key}
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
            required: REQUIRED_FIELD_ERROR_MESSAGE,
          }}
          disabled={isLoading}
        />
      </Row>
    </Section>
  );
};
