import { FC } from 'react';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';
import { SectionSaveButton } from './SectionSaveButton';

const { occupationalMedicineEmployerInformation } = PATIENT_RECORD_CONFIG.FormFields;
const FIELD_KEYS = Object.values(occupationalMedicineEmployerInformation.items).map((item) => item.key);
const REQUIRED_FIELD_KEYS = occupationalMedicineEmployerInformation.requiredFields ?? [];

interface OccupationalMedicineEmployerInformationContainerProps {
  isLoading: boolean;
  patientId?: string;
  encounterId?: string;
}

export const OccupationalMedicineEmployerInformationContainer: FC<
  OccupationalMedicineEmployerInformationContainerProps
> = ({ isLoading, patientId, encounterId }) => {
  const { items, hiddenFields, requiredFields } = usePatientRecordFormSection({
    formSection: occupationalMedicineEmployerInformation,
  });

  return (
    <PatientRecordFormSection
      formSection={occupationalMedicineEmployerInformation}
      titleWidget={
        <SectionSaveButton
          fieldKeys={FIELD_KEYS}
          requiredFieldKeys={REQUIRED_FIELD_KEYS}
          patientId={patientId}
          encounterId={encounterId}
        />
      }
    >
      <PatientRecordFormField
        item={items.employerName}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
    </PatientRecordFormSection>
  );
};
