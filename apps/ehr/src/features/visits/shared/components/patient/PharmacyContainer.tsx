import { FormFieldItemRecord } from 'config-types';
import { FC } from 'react';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';
import { SectionSaveButton } from './SectionSaveButton';

const preferredPharmacySection = PATIENT_RECORD_CONFIG.FormFields.preferredPharmacy;

// Recursively collect keys so group sub-fields (e.g. pharmacy-places-id) are tracked for dirty state.
const collectFieldKeys = (items: FormFieldItemRecord): string[] =>
  Object.values(items).flatMap((item) =>
    item.type === 'group' ? [item.key, ...collectFieldKeys(item.items)] : [item.key]
  );

const FIELD_KEYS = collectFieldKeys(preferredPharmacySection.items);

interface PharmacyContainerProps {
  isLoading: boolean;
  patientId?: string;
  encounterId?: string;
}

export const PharmacyContainer: FC<PharmacyContainerProps> = ({ isLoading, patientId, encounterId }) => {
  const {
    items: fields,
    hiddenFields,
    requiredFields,
  } = usePatientRecordFormSection({ formSection: preferredPharmacySection });
  return (
    <PatientRecordFormSection
      formSection={preferredPharmacySection}
      titleWidget={<SectionSaveButton fieldKeys={FIELD_KEYS} patientId={patientId} encounterId={encounterId} />}
    >
      {Object.values(fields).map((item) => (
        <PatientRecordFormField
          key={item.key}
          item={item}
          isLoading={isLoading}
          hiddenFormFields={hiddenFields}
          requiredFormFields={requiredFields}
          omitRowWrapper={item.type === 'group' || item.type === 'boolean'}
        />
      ))}
    </PatientRecordFormSection>
  );
};
