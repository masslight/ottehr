import { Box, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { Row } from 'src/components/layout/Row';
import { formatPhoneNumberDisplay } from 'utils/lib/helpers/helpers';
import { PATIENT_RECORD_CONFIG } from 'utils/lib/ottehr-config/patient-record';
import { AddressBookContact } from 'utils/lib/types/data/address-book';
import { PatientRecordAddressBookField } from './PatientRecordAddressBookField';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';
import { SectionSaveButton } from './SectionSaveButton';

const { employerInformation } = PATIENT_RECORD_CONFIG.FormFields;
const FIELD_KEYS = Object.values(employerInformation.items).map((item) => item.key);

interface EmployerInformationContainerProps {
  isLoading: boolean;
  patientId?: string;
  encounterId?: string;
}

export const EmployerInformationContainer: FC<EmployerInformationContainerProps> = ({
  isLoading,
  patientId,
  encounterId,
}) => {
  const { items, hiddenFields, requiredFields } = usePatientRecordFormSection({ formSection: employerInformation });
  const theme = useTheme();
  const { setValue } = useFormContext();

  // Every field is set (to '' when the contact lacks it) so a re-pick leaves nothing stale.
  const fillFromContact = (contact: AddressBookContact): void => {
    const set = (item: { key: string }, value: string): void => setValue(item.key, value, { shouldDirty: true });
    set(items.addressLine1, contact.address?.line1 ?? '');
    set(items.addressLine2, contact.address?.line2 ?? '');
    set(items.city, contact.address?.city ?? '');
    set(items.state, contact.address?.state ?? '');
    set(items.zip, contact.address?.zip ?? '');
    set(items.contactFirstName, contact.firstName ?? '');
    set(items.contactLastName, contact.lastName ?? '');
    // The directory has no job title; the credential is the closest thing to one.
    set(items.contactTitle, contact.credential ?? '');
    set(items.contactEmail, contact.email ?? '');
    set(items.contactPhone, formatPhoneNumberDisplay(contact.phone));
    set(items.contactFax, formatPhoneNumberDisplay(contact.fax));
  };
  return (
    <PatientRecordFormSection
      formSection={employerInformation}
      titleWidget={<SectionSaveButton fieldKeys={FIELD_KEYS} patientId={patientId} encounterId={encounterId} />}
    >
      <Typography sx={{ color: theme.palette.primary.dark, fontWeight: 600 }}>Insurance Information</Typography>
      <PatientRecordFormField
        item={items.workersCompInsurance}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
      <PatientRecordFormField
        item={items.workersCompMemberId}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
      <Typography sx={{ color: theme.palette.primary.dark, fontWeight: 600 }}>Employer Information</Typography>
      <PatientRecordAddressBookField
        item={items.employerName}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
        tag="employer"
        onSelect={fillFromContact}
      />
      <PatientRecordFormField
        item={items.addressLine1}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
      <PatientRecordFormField
        item={items.addressLine2}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
      <Row label="City, State, ZIP">
        <Box sx={{ display: 'flex', gap: 2 }}>
          <PatientRecordFormField
            item={items.city}
            isLoading={isLoading}
            hiddenFormFields={hiddenFields}
            requiredFormFields={requiredFields}
            omitRowWrapper
          />
          <PatientRecordFormField
            item={items.state}
            isLoading={isLoading}
            hiddenFormFields={hiddenFields}
            requiredFormFields={requiredFields}
            omitRowWrapper
          />
          <PatientRecordFormField
            item={items.zip}
            isLoading={isLoading}
            hiddenFormFields={hiddenFields}
            requiredFormFields={requiredFields}
            omitRowWrapper
          />
        </Box>
      </Row>
      <Typography sx={{ color: theme.palette.primary.dark, fontWeight: 600 }}>Employer Contact</Typography>
      <PatientRecordFormField
        item={items.contactFirstName}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
      <PatientRecordFormField
        item={items.contactLastName}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
      <PatientRecordFormField
        item={items.contactTitle}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
      <PatientRecordFormField
        item={items.contactEmail}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
      <PatientRecordFormField
        item={items.contactPhone}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
      <PatientRecordFormField
        item={items.contactFax}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
    </PatientRecordFormSection>
  );
};
