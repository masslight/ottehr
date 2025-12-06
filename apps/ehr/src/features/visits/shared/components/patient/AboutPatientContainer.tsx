import { FC } from 'react';
import { Section } from 'src/components/layout';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';

const { patientSummary } = PATIENT_RECORD_CONFIG.FormFields;
const hiddenFormFields = PATIENT_RECORD_CONFIG.hiddenFormFields.patientSummary;
const requiredFormFields = PATIENT_RECORD_CONFIG.requiredFormFields.patientSummary;
const hiddenFormSections = PATIENT_RECORD_CONFIG.hiddenFormSections;

export const AboutPatientContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  // todo: take this id from config
  if (hiddenFormSections.includes('patient-info-section')) {
    return null;
  }

  return (
    // todo: take this title from config
    <Section title="Patient information">
      {Object.values(patientSummary).map((item) => {
        return (
          <PatientRecordFormField
            key={item.key}
            item={item}
            hiddenFormFields={hiddenFormFields}
            requiredFormFields={requiredFormFields}
            isLoading={isLoading}
          />
        );
      })}
    </Section>
  );
};
