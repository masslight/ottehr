import { FC } from 'react';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';
import { SectionSaveButton } from './SectionSaveButton';

const { attorneyInformation } = PATIENT_RECORD_CONFIG.FormFields;
const FIELD_KEYS = Object.values(attorneyInformation.items).map((item) => item.key);
const REQUIRED_FIELD_KEYS = attorneyInformation.requiredFields ?? [];

interface AttorneyInformationContainerProps {
  isLoading: boolean;
  patientId?: string;
  encounterId?: string;
}

export const AttorneyInformationContainer: FC<AttorneyInformationContainerProps> = ({
  isLoading,
  patientId,
  encounterId,
}) => {
  const { items, hiddenFields, requiredFields } = usePatientRecordFormSection({ formSection: attorneyInformation });

  return (
    <PatientRecordFormSection
      formSection={attorneyInformation}
      titleWidget={
        <SectionSaveButton
          fieldKeys={FIELD_KEYS}
          requiredFieldKeys={REQUIRED_FIELD_KEYS}
          patientId={patientId}
          encounterId={encounterId}
        />
      }
    >
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
