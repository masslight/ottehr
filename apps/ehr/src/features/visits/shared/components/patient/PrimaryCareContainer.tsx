import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { formatPhoneNumberDisplay } from 'utils/lib/helpers/helpers';
import { PATIENT_RECORD_CONFIG } from 'utils/lib/ottehr-config/patient-record';
import { AddressBookContact } from 'utils/lib/types/data/address-book';
import { PatientRecordAddressBookField } from './PatientRecordAddressBookField';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';
import { SectionSaveButton } from './SectionSaveButton';

const primaryCareSection = PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician;
const FIELD_KEYS = Object.values(primaryCareSection.items).map((item) => item.key);

/** The PCP address is one line: "line1, line2, city, state zip". */
const formatContactAddress = ({ line1, line2, city, state, zip }: NonNullable<AddressBookContact['address']>): string =>
  [line1, line2, city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');

interface PrimaryCareContainerProps {
  isLoading: boolean;
  patientId?: string;
  encounterId?: string;
}

export const PrimaryCareContainer: FC<PrimaryCareContainerProps> = ({ isLoading, patientId, encounterId }) => {
  const { items, hiddenFields, requiredFields } = usePatientRecordFormSection({ formSection: primaryCareSection });
  const { setValue } = useFormContext();

  // Every field is set (to '' when the contact lacks it) so a re-pick leaves nothing stale.
  const fillFromContact = (contact: AddressBookContact): void => {
    const set = (item: { key: string }, value: string): void => setValue(item.key, value, { shouldDirty: true });
    set(items.lastName, contact.lastName ?? '');
    set(items.practiceName, contact.organizationName ?? '');
    set(items.address, contact.address ? formatContactAddress(contact.address) : '');
    set(items.phone, formatPhoneNumberDisplay(contact.phone));
    set(items.fax, formatPhoneNumberDisplay(contact.fax));
  };

  return (
    <PatientRecordFormSection
      formSection={primaryCareSection}
      titleWidget={<SectionSaveButton fieldKeys={FIELD_KEYS} patientId={patientId} encounterId={encounterId} />}
    >
      {Object.values(items).map((item) =>
        item.key === items.firstName.key ? (
          <PatientRecordAddressBookField
            key={item.key}
            item={item}
            isLoading={isLoading}
            hiddenFormFields={hiddenFields}
            requiredFormFields={requiredFields}
            tag="pcp"
            fieldValue={(contact) => contact.firstName ?? ''}
            onSelect={fillFromContact}
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
