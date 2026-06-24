import { FC } from 'react';
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
}

export const AboutPatientContainer: FC<AboutPatientContainerProps> = ({ isLoading, patientId, encounterId }) => {
  const { hiddenFields, requiredFields } = usePatientRecordFormSection({
    formSection: patientSummary,
  });
  return (
    <PatientRecordFormSection
      formSection={patientSummary}
      titleWidget={<SectionSaveButton fieldKeys={FIELD_KEYS} patientId={patientId} encounterId={encounterId} />}
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
