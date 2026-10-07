import { Box, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { Row } from 'src/components/layout/Row';
import { useContactFields } from 'src/features/address-book/useContactFields';
import { PATIENT_RECORD_CONFIG } from 'utils/lib/ottehr-config/patient-record';
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
  const { onSelect, toContact } = useContactFields({
    organizationName: items.employerName.key,
    line1: items.addressLine1.key,
    line2: items.addressLine2.key,
    city: items.city.key,
    state: items.state.key,
    zip: items.zip.key,
    firstName: items.contactFirstName.key,
    lastName: items.contactLastName.key,
    title: items.contactTitle.key,
    email: items.contactEmail.key,
    phone: items.contactPhone.key,
    fax: items.contactFax.key,
  });

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
        onSelect={onSelect}
        toContact={toContact}
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
