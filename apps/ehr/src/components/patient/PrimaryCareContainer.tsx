import { Box, Checkbox, FormControlLabel, Typography } from '@mui/material';
import { FC } from 'react';
import { isPhoneNumberValid, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import { Controller, useFormContext } from 'react-hook-form';
import { Row, Section } from '../layout';
import { FormTextField } from '../form';
import { FormFields as AllFormFields } from '../../constants';
import InputMask from '../InputMask';
import { dataTestIds } from '../../constants/data-test-ids';

const FormFields = AllFormFields.primaryCarePhysician;
export const PrimaryCareContainer: FC = () => {
  const { control, watch, setValue, resetField } = useFormContext();

  const isActive = watch(FormFields.active.key, true);

  return (
    <Section title="Primary care physician">
      <Controller
        name={FormFields.active.key}
        control={control}
        render={({ field: { value } }) => (
          <FormControlLabel
            control={
              <Checkbox
                data-testid={dataTestIds.primaryCarePhysicianContainer.pcpCheckbox}
                checked={!value}
                onClick={(e) => {
                  const checked = (e.target as HTMLInputElement).checked;
                  setValue(FormFields.active.key, !checked, { shouldDirty: true });
                  if (checked) {
                    const pcpFields = [
                      FormFields.firstName.key,
                      FormFields.lastName.key,
                      FormFields.practiceName.key,
                      FormFields.address.key,
                      FormFields.phone.key,
                    ];
                    pcpFields.forEach((field) => resetField(field, { defaultValue: '' }));
                  }
                }}
              />
            }
            label={<Typography>Patient doesn't have a PCP at this time</Typography>}
          />
        )}
      />
      <Box sx={{ display: isActive ? 'contents' : 'none' }}>
        <Row label="First name" inputId={FormFields.firstName.key} required={isActive}>
          <FormTextField
            name={FormFields.firstName.key}
            control={control}
            rules={{
              validate: (value: string) => {
                if (isActive && !value) return REQUIRED_FIELD_ERROR_MESSAGE;
                return true;
              },
            }}
            id={FormFields.firstName.key}
            data-testid={dataTestIds.primaryCarePhysicianContainer.firstName}
          />
        </Row>
        <Row label="Last name" inputId={FormFields.lastName.key} required={isActive}>
          <FormTextField
            name={FormFields.lastName.key}
            control={control}
            rules={{
              validate: (value: string) => {
                if (isActive && !value) return REQUIRED_FIELD_ERROR_MESSAGE;
                return true;
              },
            }}
            id={FormFields.lastName.key}
            data-testid={dataTestIds.primaryCarePhysicianContainer.lastName}
          />
        </Row>
        <Row label="Practice name" inputId={FormFields.practiceName.key} required={isActive}>
          <FormTextField
            name={FormFields.practiceName.key}
            control={control}
            rules={{
              validate: (value: string) => {
                if (isActive && !value) return REQUIRED_FIELD_ERROR_MESSAGE;
                return true;
              },
            }}
            id={FormFields.practiceName.key}
            data-testid={dataTestIds.primaryCarePhysicianContainer.practiceName}
          />
        </Row>
        <Row label="Address" inputId={FormFields.address.key} required={isActive}>
          <FormTextField
            name={FormFields.address.key}
            control={control}
            rules={{
              validate: (value: string) => {
                if (isActive && !value) return REQUIRED_FIELD_ERROR_MESSAGE;
                return true;
              },
            }}
            id={FormFields.address.key}
            data-testid={dataTestIds.primaryCarePhysicianContainer.address}
          />
        </Row>
        <Row label="Mobile" inputId={FormFields.phone.key} required={isActive}>
          <FormTextField
            data-testid={dataTestIds.primaryCarePhysicianContainer.mobile}
            name={FormFields.phone.key}
            control={control}
            rules={{
              validate: (value: string) => {
                if (!isActive) return true;
                if (!value) return REQUIRED_FIELD_ERROR_MESSAGE;
                return isPhoneNumberValid(value) || 'Phone number must be 10 digits in the format (xxx) xxx-xxxx';
              },
            }}
            id={FormFields.phone.key}
            inputProps={{ mask: '(000) 000-0000' }}
            InputProps={{
              inputComponent: InputMask as any,
            }}
          />
        </Row>
      </Box>
    </Section>
  );
};
