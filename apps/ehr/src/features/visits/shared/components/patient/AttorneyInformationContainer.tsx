import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { formatPhoneNumberDisplay } from 'utils/lib/helpers/helpers';
import { PATIENT_RECORD_CONFIG } from 'utils/lib/ottehr-config/patient-record';
import { AddressBookContact } from 'utils/lib/types/data/address-book';
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
  const { setValue } = useFormContext();

  // Every field is set (to '' when the contact lacks it) so a re-pick leaves nothing stale.
  const fillFromContact = (contact: AddressBookContact): void => {
    const set = (item: { key: string }, value: string): void => setValue(item.key, value, { shouldDirty: true });
    set(items.firstName, contact.firstName ?? '');
    set(items.lastName, contact.lastName ?? '');
    set(items.email, contact.email ?? '');
    set(items.mobile, formatPhoneNumberDisplay(contact.phone));
    set(items.fax, formatPhoneNumberDisplay(contact.fax));
  };

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
            onSelect={fillFromContact}
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
