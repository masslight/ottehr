import { FC } from 'react';
import { useContactFields } from 'src/features/address-book/useContactFields';
import { PATIENT_RECORD_CONFIG } from 'utils/lib/ottehr-config/patient-record';
import { PatientRecordAddressBookField } from './PatientRecordAddressBookField';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';
import { SectionSaveButton } from './SectionSaveButton';

const primaryCareSection = PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician;
const FIELD_KEYS = Object.values(primaryCareSection.items).map((item) => item.key);

interface PrimaryCareContainerProps {
  isLoading: boolean;
  patientId?: string;
  encounterId?: string;
}

export const PrimaryCareContainer: FC<PrimaryCareContainerProps> = ({ isLoading, patientId, encounterId }) => {
  const { items, hiddenFields, requiredFields } = usePatientRecordFormSection({ formSection: primaryCareSection });
  const { onSelect, toContact } = useContactFields({
    organizationName: items.practiceName.key,
    firstName: items.firstName.key,
    lastName: items.lastName.key,
    fullAddress: items.address.key,
    phone: items.phone.key,
    fax: items.fax.key,
  });

  return (
    <PatientRecordFormSection
      formSection={primaryCareSection}
      titleWidget={<SectionSaveButton fieldKeys={FIELD_KEYS} patientId={patientId} encounterId={encounterId} />}
    >
      {Object.values(items).map((item) =>
        item.key === items.practiceName.key ? (
          <PatientRecordAddressBookField
            key={item.key}
            item={item}
            isLoading={isLoading}
            hiddenFormFields={hiddenFields}
            requiredFormFields={requiredFields}
            tag="pcp"
            onSelect={onSelect}
            toContact={toContact}
          />
        ) : (
          <PatientRecordFormField
            key={item.key}
            item={item}
            isLoading={isLoading}
            hiddenFormFields={hiddenFields}
            requiredFormFields={requiredFields}
            omitRowWrapper={item.type === 'boolean'}
          />
        )
      )}
    </PatientRecordFormSection>
  );
};
