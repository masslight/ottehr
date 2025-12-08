import { FC } from 'react';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';

const preferredPharmacySection = PATIENT_RECORD_CONFIG.FormFields.preferredPharmacy;

export const PharmacyContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const {
    items: fields,
    hiddenFields,
    requiredFields,
  } = usePatientRecordFormSection({ formSection: preferredPharmacySection });
  return (
    <PatientRecordFormSection formSection={preferredPharmacySection}>
      {Object.values(fields).map((item) => (
        <PatientRecordFormField
          key={item.key}
          item={item}
          isLoading={isLoading}
          hiddenFormFields={hiddenFields}
          requiredFormFields={requiredFields}
        />
      ))}
    </PatientRecordFormSection>
  );
};
