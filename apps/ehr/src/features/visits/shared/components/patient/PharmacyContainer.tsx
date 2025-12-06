import { FC } from 'react';
import { Section } from 'src/components/layout';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';

const fields = PATIENT_RECORD_CONFIG.FormFields.preferredPharmacy;
const {
  hiddenFormFields: allHiddenFields,
  requiredFormFields: allRequiredFields,
  hiddenFormSections,
} = PATIENT_RECORD_CONFIG;

const hiddenFields = allHiddenFields.preferredPharmacy;
const requiredFields = allRequiredFields.preferredPharmacy;

export const PharmacyContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  if (hiddenFormSections.includes('preferred-pharmacy-section')) {
    return null;
  }

  return (
    <Section title="Preferred pharmacy">
      {Object.values(fields).map((item) => (
        <PatientRecordFormField
          key={item.key}
          item={item}
          isLoading={isLoading}
          hiddenFormFields={hiddenFields}
          requiredFormFields={requiredFields}
        />
      ))}
    </Section>
  );
};
