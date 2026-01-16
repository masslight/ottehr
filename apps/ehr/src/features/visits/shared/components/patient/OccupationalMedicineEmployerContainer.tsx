import { FC } from 'react';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';

const { occupationalMedicineEmployerInformation } = PATIENT_RECORD_CONFIG.FormFields;

export const OccupationalMedicineEmployerInformationContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const { items, hiddenFields, requiredFields } = usePatientRecordFormSection({
    formSection: occupationalMedicineEmployerInformation,
  });

  return (
    <PatientRecordFormSection formSection={occupationalMedicineEmployerInformation}>
      <PatientRecordFormField
        item={items.employerName}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
    </PatientRecordFormSection>
  );
};
