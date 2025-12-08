import { Box } from '@mui/material';
import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';

const primaryCareSection = PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician;
export const PrimaryCareContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const { watch } = useFormContext();

  const {
    items: primaryCare,
    hiddenFields,
    requiredFields,
  } = usePatientRecordFormSection({ formSection: primaryCareSection });
  const isActive = watch(primaryCare.active.key, true);

  const contentFields = Object.values(primaryCare).filter((field) => field.key !== 'pcp-active');

  return (
    <PatientRecordFormSection formSection={primaryCareSection}>
      <PatientRecordFormField
        key={primaryCare.active.key}
        item={primaryCare.active}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
        omitRowWrapper
      />
      <Box sx={{ display: isActive ? 'contents' : 'none' }}>
        {contentFields.map((item) => (
          <PatientRecordFormField
            key={item.key}
            item={item}
            isLoading={isLoading}
            hiddenFormFields={hiddenFields}
            requiredFormFields={requiredFields}
          />
        ))}
      </Box>
    </PatientRecordFormSection>
  );
};
