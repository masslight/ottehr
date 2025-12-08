import { Box } from '@mui/material';
import { FC, useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { Row } from 'src/components/layout';
import { PatientAddressFields } from 'src/constants';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';

const { emergencyContact } = PATIENT_RECORD_CONFIG.FormFields;

export const EmergencyContactContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const { watch, setValue } = useFormContext();

  const {
    hiddenFields,
    requiredFields,
    items: FormFields,
  } = usePatientRecordFormSection({ formSection: emergencyContact });

  const emergencyAddressFields = useMemo(
    () => [
      FormFields.streetAddress.key,
      FormFields.addressLine2.key,
      FormFields.city.key,
      FormFields.state.key,
      FormFields.zip.key,
    ],
    [
      FormFields.addressLine2.key,
      FormFields.city.key,
      FormFields.state.key,
      FormFields.streetAddress.key,
      FormFields.zip.key,
    ]
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

  return (
    <PatientRecordFormSection formSection={emergencyContact}>
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
    </PatientRecordFormSection>
  );
};
