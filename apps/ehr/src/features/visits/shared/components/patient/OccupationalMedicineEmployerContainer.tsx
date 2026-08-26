import { Typography } from '@mui/material';
import { Reference } from 'fhir/r4b';
import { FC } from 'react';
import { useWatch } from 'react-hook-form';
import { Row } from 'src/components/layout/Row';
import { PATIENT_RECORD_CONFIG } from 'utils/lib/ottehr-config/patient-record';
import { OCCUPATIONAL_MEDICINE_EMPLOYER_FIELD_KEY } from '../../visitEmployer';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';
import { SectionSaveButton } from './SectionSaveButton';
import { useEmployerNotes } from './useEmployerNotes';

const { occupationalMedicineEmployerInformation } = PATIENT_RECORD_CONFIG.FormFields;
const FIELD_KEYS = Object.values(occupationalMedicineEmployerInformation.items).map((item) => item.key);

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

  // Read-only reference copy of the notes staff maintain on the employer itself, following whichever
  // employer is currently selected in the dropdown.
  const selectedEmployer = useWatch<Record<string, Reference | null>>({
    name: OCCUPATIONAL_MEDICINE_EMPLOYER_FIELD_KEY,
  });
  const employerNotes = useEmployerNotes(selectedEmployer);

  // Pre-op visits show "Employer - Pre-Op"; other visit types keep the section's config title.
  const title = useUpdateVisitDetailsForEmployer ? 'Employer - Pre-Op' : undefined;

  return (
    <PatientRecordFormSection
      formSection={occupationalMedicineEmployerInformation}
      title={title}
      titleWidget={
        <SectionSaveButton
          fieldKeys={FIELD_KEYS}
          patientId={patientId}
          encounterId={encounterId}
          appointmentId={appointmentId}
          useUpdateVisitDetailsForEmployer={useUpdateVisitDetailsForEmployer}
        />
      }
    >
      <>
        <PatientRecordFormField
          item={items.employerName}
          isLoading={isLoading}
          hiddenFormFields={hiddenFields}
          requiredFormFields={requiredFields}
        />
        {employerNotes && (
          <Row label="Employer Notes">
            <Typography sx={{ whiteSpace: 'pre-wrap' }}>{employerNotes}</Typography>
          </Row>
        )}
      </>
    </PatientRecordFormSection>
  );
};
