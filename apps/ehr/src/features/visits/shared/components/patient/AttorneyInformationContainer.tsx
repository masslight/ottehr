import { FC } from 'react';
import { useContactFields } from 'src/features/address-book/useContactFields';
import { PATIENT_RECORD_CONFIG } from 'utils/lib/ottehr-config/patient-record';
import { PatientRecordAddressBookField } from './PatientRecordAddressBookField';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';
import { SectionSaveButton } from './SectionSaveButton';

const { attorneyInformation } = PATIENT_RECORD_CONFIG.FormFields;
const FIELD_KEYS = Object.values(attorneyInformation.items).map((item) => item.key);

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
  const { onSelect, toContact } = useContactFields({
    organizationName: items.firm.key,
    firstName: items.firstName.key,
    lastName: items.lastName.key,
    email: items.email.key,
    phone: items.mobile.key,
    fax: items.fax.key,
  });

  return (
    <PatientRecordFormSection
      formSection={attorneyInformation}
      titleWidget={<SectionSaveButton fieldKeys={FIELD_KEYS} patientId={patientId} encounterId={encounterId} />}
    >
      {Object.values(items).map((item) =>
        item.key === items.firm.key ? (
          <PatientRecordAddressBookField
            key={item.key}
            item={item}
            isLoading={isLoading}
            hiddenFormFields={hiddenFields}
            requiredFormFields={requiredFields}
            tag="attorney"
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
          />
        )
      )}
    </PatientRecordFormSection>
  );
};
