import { FC } from 'react';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';
import { SectionSaveButton } from './SectionSaveButton';

const preferredPharmacySection = PATIENT_RECORD_CONFIG.FormFields.preferredPharmacy;
const FIELD_KEYS = Object.values(preferredPharmacySection.items).map((item) => item.key);
const REQUIRED_FIELD_KEYS = preferredPharmacySection.requiredFields ?? [];

interface PharmacyContainerProps {
  isLoading: boolean;
  patientId?: string;
  encounterId?: string;
}

export const PharmacyContainer: FC<PharmacyContainerProps> = ({ isLoading, patientId, encounterId }) => {
  const {
    items: fields,
    hiddenFields,
    requiredFields,
  } = usePatientRecordFormSection({ formSection: preferredPharmacySection });
  return (
    <PatientRecordFormSection
      formSection={preferredPharmacySection}
      titleWidget={
        <SectionSaveButton
          fieldKeys={FIELD_KEYS}
          requiredFieldKeys={REQUIRED_FIELD_KEYS}
          patientId={patientId}
          encounterId={encounterId}
        />
      }
    >
      {Object.values(fields).map((item) => (
        <PatientRecordFormField
          key={item.key}
          item={item}
          isLoading={isLoading}
          hiddenFormFields={hiddenFields}
          requiredFormFields={requiredFields}
          omitRowWrapper={item.type === 'group' || item.type === 'boolean'}
        />
      ))}
    </PatientRecordFormSection>
  );
};
