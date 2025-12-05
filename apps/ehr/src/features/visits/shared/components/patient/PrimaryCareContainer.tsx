import { Box, Checkbox, FormControlLabel, Typography } from '@mui/material';
import { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { FormTextField } from 'src/components/form';
import InputMask from 'src/components/InputMask';
import { Row, Section } from 'src/components/layout';
import { dataTestIds } from 'src/constants/data-test-ids';
import { isPhoneNumberValid, PATIENT_RECORD_CONFIG, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
const primaryCare = PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician;
export const PrimaryCareContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const { control, watch, setValue } = useFormContext();

  const isActive = watch(primaryCare.active.key, true);

  return (
    <Section title="Primary care physician">
      <Controller
        name={primaryCare.active.key}
        control={control}
        render={({ field: { value } }) => (
          <FormControlLabel
            control={
              <Checkbox
                data-testid={dataTestIds.primaryCarePhysicianContainer.pcpCheckbox}
                checked={!value}
                disabled={isLoading}
                onClick={(e) => {
                  const checked = (e.target as HTMLInputElement).checked;
                  setValue(primaryCare.active.key, !checked, { shouldDirty: true });
                }}
              />
            }
            label={<Typography>Patient doesn't have a PCP at this time</Typography>}
          />
        )}
      />
      <Box sx={{ display: isActive ? 'contents' : 'none' }}>
        <Row label="First name" inputId={primaryCare.firstName.key} required={isActive}>
          <FormTextField
            name={primaryCare.firstName.key}
            control={control}
            disabled={isLoading}
            rules={{
              validate: (value: string) => {
                if (isActive && !value) return REQUIRED_FIELD_ERROR_MESSAGE;
                return true;
              },
            }}
            id={primaryCare.firstName.key}
            data-testid={dataTestIds.primaryCarePhysicianContainer.firstName}
          />
        </Row>
        <Row label="Last name" inputId={primaryCare.lastName.key} required={isActive}>
          <FormTextField
            name={primaryCare.lastName.key}
            control={control}
            disabled={isLoading}
            rules={{
              validate: (value: string) => {
                if (isActive && !value) return REQUIRED_FIELD_ERROR_MESSAGE;
                return true;
              },
            }}
            id={primaryCare.lastName.key}
            data-testid={dataTestIds.primaryCarePhysicianContainer.lastName}
          />
        </Row>
        <Row label="Practice name" inputId={primaryCare.practiceName.key} required={isActive}>
          <FormTextField
            name={primaryCare.practiceName.key}
            control={control}
            disabled={isLoading}
            rules={{
              validate: (value: string) => {
                if (isActive && !value) return REQUIRED_FIELD_ERROR_MESSAGE;
                return true;
              },
            }}
            id={primaryCare.practiceName.key}
            data-testid={dataTestIds.primaryCarePhysicianContainer.practiceName}
          />
        </Row>
        <Row label="Address" inputId={primaryCare.address.key} required={isActive}>
          <FormTextField
            name={primaryCare.address.key}
            control={control}
            disabled={isLoading}
            rules={{
              validate: (value: string) => {
                if (isActive && !value) return REQUIRED_FIELD_ERROR_MESSAGE;
                return true;
              },
            }}
            id={primaryCare.address.key}
            data-testid={dataTestIds.primaryCarePhysicianContainer.address}
          />
        </Row>
        <Row label="Mobile" inputId={primaryCare.phone.key} required={isActive}>
          <FormTextField
            data-testid={dataTestIds.primaryCarePhysicianContainer.mobile}
            name={primaryCare.phone.key}
            disabled={isLoading}
            control={control}
            rules={{
              validate: (value: string) => {
                if (!isActive) return true;
                if (!value) return REQUIRED_FIELD_ERROR_MESSAGE;
                return (
                  isPhoneNumberValid(value) ||
                  'Phone number must be 10 digits in the format (xxx) xxx-xxxx and a valid number'
                );
              },
            }}
            id={primaryCare.phone.key}
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
