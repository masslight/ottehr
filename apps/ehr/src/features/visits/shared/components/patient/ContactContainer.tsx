import { Box } from '@mui/material';
import { FC } from 'react';
import { Row } from 'src/components/layout';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';
import { SectionSaveButton } from './SectionSaveButton';

const contactSection = PATIENT_RECORD_CONFIG.FormFields.patientContactInformation;

const CONTACT_FIELD_KEYS = Object.values(contactSection.items).map((item) => item.key);
const CONTACT_REQUIRED_FIELD_KEYS = contactSection.requiredFields ?? [];

interface ContactContainerProps {
  isLoading: boolean;
  patientId?: string;
  encounterId?: string;
}

export const ContactContainer: FC<ContactContainerProps> = ({ isLoading, patientId, encounterId }) => {
  const {
    items: contact,
    hiddenFields: hiddenFormFields,
    requiredFields: requiredFormFields,
  } = usePatientRecordFormSection({
    formSection: contactSection,
  });

  return (
    <PatientRecordFormSection
      formSection={contactSection}
      titleWidget={
        <SectionSaveButton
          fieldKeys={CONTACT_FIELD_KEYS}
          requiredFieldKeys={CONTACT_REQUIRED_FIELD_KEYS}
          patientId={patientId}
          encounterId={encounterId}
        />
      }
    >
      <PatientRecordFormField
        item={contact.streetAddress}
        hiddenFormFields={hiddenFormFields}
        requiredFormFields={requiredFormFields}
        isLoading={isLoading}
      />
      <PatientRecordFormField
        item={contact.addressLine2}
        hiddenFormFields={hiddenFormFields}
        requiredFormFields={requiredFormFields}
        isLoading={isLoading}
      />
      <Row label="City, State, ZIP" required>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <PatientRecordFormField
            item={contact.city}
            hiddenFormFields={hiddenFormFields}
            requiredFormFields={requiredFormFields}
            isLoading={isLoading}
            omitRowWrapper
          />
          <PatientRecordFormField
            item={contact.state}
            hiddenFormFields={hiddenFormFields}
            requiredFormFields={requiredFormFields}
            isLoading={isLoading}
            omitRowWrapper
          />
          <PatientRecordFormField
            item={contact.zip}
            hiddenFormFields={hiddenFormFields}
            requiredFormFields={requiredFormFields}
            isLoading={isLoading}
            omitRowWrapper
          />
        </Box>
      </Row>
      <PatientRecordFormField
        item={contact.email}
        hiddenFormFields={hiddenFormFields}
        requiredFormFields={requiredFormFields}
        isLoading={isLoading}
      />
      <PatientRecordFormField
        item={contact.phone}
        hiddenFormFields={hiddenFormFields}
        requiredFormFields={requiredFormFields}
        isLoading={isLoading}
      />
      <PatientRecordFormField
        item={contact.preferredCommunicationMethod}
        hiddenFormFields={hiddenFormFields}
        requiredFormFields={requiredFormFields}
        isLoading={isLoading}
      />
    </PatientRecordFormSection>
  );
};
