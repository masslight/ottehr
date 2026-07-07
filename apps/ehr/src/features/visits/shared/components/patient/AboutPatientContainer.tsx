import { Box } from '@mui/material';
import { FC, ReactNode } from 'react';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';
import { SectionSaveButton } from './SectionSaveButton';

const { patientSummary } = PATIENT_RECORD_CONFIG.FormFields;
const FIELD_KEYS = Object.values(patientSummary.items).map((item) => item.key);

interface AboutPatientContainerProps {
  isLoading: boolean;
  patientId?: string;
  encounterId?: string;
  /**
   * Optional content rendered right-aligned in the section header, next to the "Patient summary"
   * title (e.g. the visit page's compact photo-ID card thumbnail). Omitted on the standalone
   * patient-info page.
   */
  headerSlot?: ReactNode;
}

export const AboutPatientContainer: FC<AboutPatientContainerProps> = ({
  isLoading,
  patientId,
  encounterId,
  headerSlot,
}) => {
  const { hiddenFields, requiredFields } = usePatientRecordFormSection({
    formSection: patientSummary,
  });
  const saveButton = <SectionSaveButton fieldKeys={FIELD_KEYS} patientId={patientId} encounterId={encounterId} />;
  return (
    <PatientRecordFormSection
      formSection={patientSummary}
      titleWidget={
        headerSlot ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {headerSlot}
            {saveButton}
          </Box>
        ) : (
          saveButton
        )
      }
    >
      {Object.values(patientSummary.items).map((item) => {
        return (
          <PatientRecordFormField
            key={item.key}
            item={item}
            hiddenFormFields={hiddenFields}
            requiredFormFields={requiredFields}
            isLoading={isLoading}
          />
        );
      })}
    </PatientRecordFormSection>
  );
};
