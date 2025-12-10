import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { FormTextField } from 'src/components/form';
import InputMask from 'src/components/InputMask';
import { Row, Section } from 'src/components/layout';
import { FormFields } from 'src/constants';
import { dataTestIds } from 'src/constants/data-test-ids';
import { emailRegex, isPhoneNumberValid } from 'utils';

const { attorneyInformation } = FormFields;

export const AttorneyInformationContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const { control } = useFormContext();

  return (
    <Section title="Attorney for Motor Vehicle Accident" dataTestId={dataTestIds.attorneyInformationContainer.id}>
      <Row label={attorneyInformation.firm.label}>
        <FormTextField
          name={attorneyInformation.firm.key}
          control={control}
          data-testid={dataTestIds.attorneyInformationContainer.firm}
          disabled={isLoading}
        />
      </Row>
      <Row label={attorneyInformation.firstName.label}>
        <FormTextField
          name={attorneyInformation.firstName.key}
          control={control}
          data-testid={dataTestIds.attorneyInformationContainer.firstName}
          disabled={isLoading}
        />
      </Row>
      <Row label={attorneyInformation.lastName.label}>
        <FormTextField
          name={attorneyInformation.lastName.key}
          control={control}
          data-testid={dataTestIds.attorneyInformationContainer.lastName}
          disabled={isLoading}
        />
      </Row>
      <Row label={attorneyInformation.email.label}>
        <FormTextField
          name={attorneyInformation.email.key}
          control={control}
          data-testid={dataTestIds.attorneyInformationContainer.email}
          rules={{
            validate: (value: string) => {
              if (!value) return true;
              return emailRegex.test(value) || 'Must be in the format "email@example.com"';
            },
          }}
          disabled={isLoading}
        />
      </Row>
      <Row label={attorneyInformation.mobile.label}>
        <FormTextField
          name={attorneyInformation.mobile.key}
          control={control}
          data-testid={dataTestIds.attorneyInformationContainer.mobile}
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
          disabled={isLoading}
        />
      </Row>
      <Row label={attorneyInformation.fax.label}>
        <FormTextField
          name={attorneyInformation.fax.key}
          control={control}
          data-testid={dataTestIds.attorneyInformationContainer.fax}
          inputProps={{ mask: '(000) 000-0000' }}
          InputProps={{
            inputComponent: InputMask as any,
          }}
          rules={{
            validate: (value: string) => {
              if (!value) return true;
              return (
                isPhoneNumberValid(value) ||
                'Fax number must be 10 digits in the format (xxx) xxx-xxxx and a valid number'
              );
            },
          }}
          disabled={isLoading}
        />
      </Row>
    </Section>
  );
};
