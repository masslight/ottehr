import { Box, Checkbox, FormControlLabel, Typography } from '@mui/material';
import { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Section } from 'src/components/layout';
import { dataTestIds } from 'src/constants/data-test-ids';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';

const primaryCare = PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician;
const {
  hiddenFormFields: allHiddenFields,
  requiredFormFields: allRequiredFields,
  hiddenFormSections,
} = PATIENT_RECORD_CONFIG;

const hiddenFields = allHiddenFields.primaryCarePhysician;
const requiredFields = allRequiredFields.primaryCarePhysician;

export const PrimaryCareContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const { control, watch, setValue } = useFormContext();

  if (hiddenFormSections.includes('primary-care-physician-section')) {
    return null;
  }
  const isActive = watch(primaryCare.active.key, true);

  const contentFields = Object.values(primaryCare).filter((field) => field.key !== 'pcp-active');

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
            label={<Typography>{primaryCare.active.label}</Typography>}
          />
        )}
      />
      <Box sx={{ display: isActive ? 'contents' : 'none' }}>
        {contentFields.map((item) => (
          <PatientRecordFormField
            item={item}
            isLoading={isLoading}
            hiddenFormFields={hiddenFields}
            requiredFormFields={requiredFields}
          />
        ))}
      </Box>
    </Section>
  );
};
