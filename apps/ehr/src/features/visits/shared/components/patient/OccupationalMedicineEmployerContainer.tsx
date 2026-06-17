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
  appointmentId?: string;
  useUpdateVisitDetailsForEmployer?: boolean;
}

export const OccupationalMedicineEmployerInformationContainer: FC<
  OccupationalMedicineEmployerInformationContainerProps
> = ({ isLoading, patientId, encounterId, appointmentId, useUpdateVisitDetailsForEmployer }) => {
  const { items, hiddenFields, requiredFields } = usePatientRecordFormSection({
    formSection: occupationalMedicineEmployerInformation,
  });

  // Pre-op visits show "Employer - Pre-Op"; other visit types keep the section's config title.
  const title = useUpdateVisitDetailsForEmployer ? 'Employer - Pre-Op' : undefined;

  return (
    <PatientRecordFormSection
      formSection={occupationalMedicineEmployerInformation}
      title={title}
      titleWidget={
        <SectionSaveButton
          fieldKeys={FIELD_KEYS}
          requiredFieldKeys={REQUIRED_FIELD_KEYS}
          patientId={patientId}
          encounterId={encounterId}
          appointmentId={appointmentId}
          useUpdateVisitDetailsForEmployer={useUpdateVisitDetailsForEmployer}
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
