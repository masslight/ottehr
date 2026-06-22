import { FC } from 'react';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';
import { SectionSaveButton } from './SectionSaveButton';

const primaryCareSection = PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician;
const FIELD_KEYS = Object.values(primaryCareSection.items).map((item) => item.key);

interface PrimaryCareContainerProps {
  isLoading: boolean;
  patientId?: string;
  encounterId?: string;
}

export const PrimaryCareContainer: FC<PrimaryCareContainerProps> = ({ isLoading, patientId, encounterId }) => {
  const { items, hiddenFields, requiredFields } = usePatientRecordFormSection({ formSection: primaryCareSection });

  return (
    <PatientRecordFormSection
      formSection={primaryCareSection}
      titleWidget={<SectionSaveButton fieldKeys={FIELD_KEYS} patientId={patientId} encounterId={encounterId} />}
    >
      {Object.values(items).map((item) => (
        <PatientRecordFormField
          key={item.key}
          item={item}
          isLoading={isLoading}
          hiddenFormFields={hiddenFields}
          requiredFormFields={requiredFields}
          omitRowWrapper={item.type === 'boolean'}
        />
      ))}
    </PatientRecordFormSection>
  );
};
