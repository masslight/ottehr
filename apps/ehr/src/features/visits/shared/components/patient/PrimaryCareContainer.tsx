import { FC } from 'react';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';

const primaryCareSection = PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician;
export const PrimaryCareContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const { items, hiddenFields, requiredFields } = usePatientRecordFormSection({ formSection: primaryCareSection });

  return (
    <PatientRecordFormSection formSection={primaryCareSection}>
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
