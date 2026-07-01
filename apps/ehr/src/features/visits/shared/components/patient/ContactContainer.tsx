import { Box } from '@mui/material';
import { FC, useEffect, useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Row } from 'src/components/layout';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';
import { SectionSaveButton } from './SectionSaveButton';

const contactSection = PATIENT_RECORD_CONFIG.FormFields.patientContactInformation;

const FIELD_KEYS = Object.values(contactSection.items).map((item) => item.key);

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

  const { setValue } = useFormContext();
  const noEmailChecked = useWatch({ name: 'patient-no-email' });

  useEffect(() => {
    if (noEmailChecked) {
      setValue('patient-email', '', { shouldDirty: true });
    }
  }, [noEmailChecked, setValue]);

  const effectiveRequiredFormFields = useMemo(
    () => (noEmailChecked ? (requiredFormFields ?? []).filter((k) => k !== 'patient-email') : requiredFormFields),
    [noEmailChecked, requiredFormFields]
  );

  return (
    <PatientRecordFormSection
      formSection={contactSection}
      titleWidget={<SectionSaveButton fieldKeys={FIELD_KEYS} patientId={patientId} encounterId={encounterId} />}
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
        requiredFormFields={effectiveRequiredFormFields}
        isLoading={isLoading}
      />
      <PatientRecordFormField
        item={contact.noEmail}
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
