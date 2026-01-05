import { FC } from 'react';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';

const { patientSummary } = PATIENT_RECORD_CONFIG.FormFields;

export const AboutPatientContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const { hiddenFields, requiredFields } = usePatientRecordFormSection({
    formSection: patientSummary,
  });
  return (
    <PatientRecordFormSection formSection={patientSummary}>
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
