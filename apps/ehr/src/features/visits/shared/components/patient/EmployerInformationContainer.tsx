import { Box } from '@mui/material';
import { FC } from 'react';
import { Row, Section } from 'src/components/layout';
import { dataTestIds } from 'src/constants/data-test-ids';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';

const { employerInformation } = PATIENT_RECORD_CONFIG.FormFields;
const {
  hiddenFormFields: allHiddenFields,
  requiredFormFields: allRequiredFields,
  hiddenFormSections,
} = PATIENT_RECORD_CONFIG;

const hiddenFields = allHiddenFields.employerInformation;
const requiredFields = allRequiredFields.employerInformation;

export const EmployerInformationContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  // todo: take this item from config
  if (hiddenFormSections.includes('employer-information-page')) {
    return null;
  }

  return (
    <Section title="Employer information" dataTestId={dataTestIds.employerInformationContainer.id}>
      <PatientRecordFormField
        item={employerInformation.employerName}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
      <PatientRecordFormField
        item={employerInformation.addressLine1}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
      <PatientRecordFormField
        item={employerInformation.addressLine2}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
      <Row label="City, State, ZIP">
        <Box sx={{ display: 'flex', gap: 2 }}>
          <PatientRecordFormField
            item={employerInformation.city}
            isLoading={isLoading}
            hiddenFormFields={hiddenFields}
            requiredFormFields={requiredFields}
            omitRowWrapper
          />
          <PatientRecordFormField
            item={employerInformation.state}
            isLoading={isLoading}
            hiddenFormFields={hiddenFields}
            requiredFormFields={requiredFields}
            omitRowWrapper
          />
          <PatientRecordFormField
            item={employerInformation.zip}
            isLoading={isLoading}
            hiddenFormFields={hiddenFields}
            requiredFormFields={requiredFields}
            omitRowWrapper
          />
        </Box>
      </Row>
      <PatientRecordFormField
        item={employerInformation.contactFirstName}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
      <PatientRecordFormField
        item={employerInformation.contactLastName}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
      <PatientRecordFormField
        item={employerInformation.contactTitle}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
      <PatientRecordFormField
        item={employerInformation.contactEmail}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
      <PatientRecordFormField
        item={employerInformation.contactPhone}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
      <PatientRecordFormField
        item={employerInformation.contactFax}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
    </Section>
  );
};
