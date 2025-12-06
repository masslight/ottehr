import { Box } from '@mui/material';
import { FC, useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { Row, Section } from 'src/components/layout';
import { PatientAddressFields } from 'src/constants';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';

const { emergencyContact: FormFields } = PATIENT_RECORD_CONFIG.FormFields;
const {
  hiddenFormFields: allHiddenFields,
  requiredFormFields: allRequiredFields,
  hiddenFormSections,
} = PATIENT_RECORD_CONFIG;

const hiddenFields = allHiddenFields.emergencyContact;
const requiredFields = allRequiredFields.emergencyContact;

export const EmergencyContactContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const { watch, setValue } = useFormContext();

  const emergencyAddressFields = useMemo(
    () => [
      FormFields.streetAddress.key,
      FormFields.addressLine2.key,
      FormFields.city.key,
      FormFields.state.key,
      FormFields.zip.key,
    ],
    []
  );

  const patientAddressData = watch(PatientAddressFields);
  const emergencyAddressData = watch(emergencyAddressFields);
  const sameAsPatientAddress = watch(FormFields.addressAsPatient.key, false);

  useEffect(() => {
    if (!sameAsPatientAddress) return;
    for (let i = 0; i < emergencyAddressData.length; i++) {
      if (patientAddressData[i] && emergencyAddressData[i] !== patientAddressData[i]) {
        setValue(emergencyAddressFields[i], patientAddressData[i]);
      }
    }
  }, [emergencyAddressData, emergencyAddressFields, patientAddressData, sameAsPatientAddress, setValue]);

  if (hiddenFormSections.includes('emergency-contact-section')) {
    return null;
  }

  return (
    <Section title="Emergency contact information">
      <PatientRecordFormField
        item={FormFields.relationship}
        isLoading={isLoading}
        requiredFormFields={requiredFields}
        hiddenFormFields={hiddenFields}
      />
      <PatientRecordFormField
        item={FormFields.firstName}
        isLoading={isLoading}
        requiredFormFields={requiredFields}
        hiddenFormFields={hiddenFields}
      />
      <PatientRecordFormField
        item={FormFields.firstName}
        isLoading={isLoading}
        requiredFormFields={requiredFields}
        hiddenFormFields={hiddenFields}
      />
      <PatientRecordFormField
        item={FormFields.middleName}
        isLoading={isLoading}
        requiredFormFields={requiredFields}
        hiddenFormFields={hiddenFields}
      />
      <PatientRecordFormField
        item={FormFields.lastName}
        isLoading={isLoading}
        requiredFormFields={requiredFields}
        hiddenFormFields={hiddenFields}
      />
      <PatientRecordFormField
        item={FormFields.phone}
        isLoading={isLoading}
        requiredFormFields={requiredFields}
        hiddenFormFields={hiddenFields}
      />
      <PatientRecordFormField
        item={FormFields.addressAsPatient}
        isLoading={isLoading}
        requiredFormFields={requiredFields}
        hiddenFormFields={hiddenFields}
      />
      <PatientRecordFormField
        item={FormFields.streetAddress}
        isLoading={isLoading}
        requiredFormFields={requiredFields}
        hiddenFormFields={hiddenFields}
        disabled={sameAsPatientAddress && Boolean(patientAddressData[0])}
      />
      <PatientRecordFormField
        item={FormFields.addressLine2}
        isLoading={isLoading}
        requiredFormFields={requiredFields}
        hiddenFormFields={hiddenFields}
        disabled={sameAsPatientAddress}
      />
      <Row label="City, State, ZIP">
        <Box sx={{ display: 'flex', gap: 2 }}>
          <PatientRecordFormField
            item={FormFields.city}
            isLoading={isLoading}
            requiredFormFields={requiredFields}
            hiddenFormFields={hiddenFields}
            disabled={sameAsPatientAddress && Boolean(patientAddressData[2])}
            omitRowWrapper
          />
          <PatientRecordFormField
            item={FormFields.state}
            isLoading={isLoading}
            requiredFormFields={requiredFields}
            hiddenFormFields={hiddenFields}
            disabled={sameAsPatientAddress && Boolean(patientAddressData[3])}
            omitRowWrapper
          />
          <PatientRecordFormField
            item={FormFields.zip}
            isLoading={isLoading}
            requiredFormFields={requiredFields}
            hiddenFormFields={hiddenFields}
            disabled={sameAsPatientAddress && Boolean(patientAddressData[4])}
            omitRowWrapper
          />
        </Box>
      </Row>
    </Section>
  );
};
