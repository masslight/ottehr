import { Box } from '@mui/material';
import { FC } from 'react';
import { Row, Section } from 'src/components/layout';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';

const contact = PATIENT_RECORD_CONFIG.FormFields.patientContactInformation;
const { hiddenFormFields: allHiddenFields, requiredFormFields: allRequiredFields } = PATIENT_RECORD_CONFIG;
const hiddenFormFields = allHiddenFields.patientContactInformation;
const requiredFormFields = allRequiredFields.patientContactInformation;

export const ContactContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  /*
  // this is just something that is known about the implementation ahead of time, so we can code it
  // into the config object rather than looking into the patient intake questionnaire
  // leaving this commented in order to help figure out which projects do need to show this
  const showPreferredCommunicationMethod =
    Object.values(inPersonIntakeQuestionnaire.fhirResources)[0]
      .resource.item.find((item) => item.linkId === 'contact-information-page')
      ?.item.find((item) => item.linkId === 'patient-preferred-communication-method') != null;
  */

  return (
    <Section title="Contact information">
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
    </Section>
  );
};
