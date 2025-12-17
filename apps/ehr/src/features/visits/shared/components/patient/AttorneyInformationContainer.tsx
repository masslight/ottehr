import { FC } from 'react';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';

const { attorneyInformation } = PATIENT_RECORD_CONFIG.FormFields;

export const AttorneyInformationContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const { items, hiddenFields, requiredFields } = usePatientRecordFormSection({ formSection: attorneyInformation });

  return (
    <PatientRecordFormSection formSection={attorneyInformation}>
      {Object.values(items).map((item) => (
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
