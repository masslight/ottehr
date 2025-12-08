import { Box } from '@mui/material';
import { FC, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { Row } from 'src/components/layout';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';

const {
  responsibleParty: responsiblePartySection,
  patientSummary: patientSummarySection,
  patientContactInformation: patientContactInformationSection,
} = PATIENT_RECORD_CONFIG.FormFields;

export const ResponsibleInformationContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const { watch, getValues, setValue } = useFormContext();

  const {
    items: responsibleParty,
    hiddenFields,
    requiredFields,
  } = usePatientRecordFormSection({ formSection: responsiblePartySection });
  const { items: patientSummary } = usePatientRecordFormSection({ formSection: patientSummarySection });
  const { items: patientContactInformation } = usePatientRecordFormSection({
    formSection: patientContactInformationSection,
  });

  const selfSelected = watch(responsibleParty.relationship.key) === 'Self';

  useEffect(() => {
    const fieldMap = {
      [responsibleParty.firstName.key]: patientSummary.firstName.key,
      [responsibleParty.lastName.key]: patientSummary.lastName.key,
      [responsibleParty.birthDate.key]: patientSummary.birthDate.key,
      [responsibleParty.birthSex.key]: patientSummary.birthSex.key,
      [responsibleParty.phone.key]: patientContactInformation.phone.key,
      [responsibleParty.email.key]: patientContactInformation.email.key,
      [responsibleParty.addressLine1.key]: patientContactInformation.streetAddress.key,
      [responsibleParty.addressLine2.key]: patientContactInformation.addressLine2.key,
      [responsibleParty.city.key]: patientContactInformation.city.key,
      [responsibleParty.state.key]: patientContactInformation.state.key,
      [responsibleParty.zip.key]: patientContactInformation.zip.key,
    };

    if (selfSelected) {
      Object.entries(fieldMap).forEach(([responsiblePartyKey, patientKey]) => {
        const patientValue = getValues(patientKey);
        const responsiblePartyValue = getValues(responsiblePartyKey);

        if (patientValue !== responsiblePartyValue) {
          setValue(responsiblePartyKey, patientValue);
        }
      });
    }

    const subscription = watch((_, { name }) => {
      if (!selfSelected || !name) return;

      const matched = Object.entries(fieldMap).find(([, patientKey]) => patientKey === name);

      if (matched) {
        const [responsiblePartyKey, patientKey] = matched;
        const patientValue = getValues(patientKey);
        const responsiblePartyValue = getValues(responsiblePartyKey);

        if (patientValue !== responsiblePartyValue) {
          setValue(responsiblePartyKey, patientValue);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [
    selfSelected,
    watch,
    setValue,
    getValues,
    responsibleParty.firstName.key,
    responsibleParty.lastName.key,
    responsibleParty.birthDate.key,
    responsibleParty.birthSex.key,
    responsibleParty.phone.key,
    responsibleParty.email.key,
    responsibleParty.addressLine1.key,
    responsibleParty.addressLine2.key,
    responsibleParty.city.key,
    responsibleParty.state.key,
    responsibleParty.zip.key,
    patientSummary.firstName.key,
    patientSummary.lastName.key,
    patientSummary.birthDate.key,
    patientSummary.birthSex.key,
    patientContactInformation.phone.key,
    patientContactInformation.email.key,
    patientContactInformation.streetAddress.key,
    patientContactInformation.addressLine2.key,
    patientContactInformation.city.key,
    patientContactInformation.state.key,
    patientContactInformation.zip.key,
  ]);

  const nonCityStateZipFields = Object.values(responsibleParty).filter((v) => {
    return ['responsible-party-zip', 'responsible-party-state', 'responsible-party-city'].includes(v.key) === false;
  });

  return (
    <PatientRecordFormSection formSection={responsiblePartySection}>
      <>
        {nonCityStateZipFields.map((item) => (
          <PatientRecordFormField
            key={item.key}
            item={item}
            isLoading={isLoading}
            hiddenFormFields={hiddenFields}
            requiredFormFields={requiredFields}
          />
        ))}
        <Row label="City, State, ZIP" required>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <PatientRecordFormField
              item={responsibleParty.city}
              isLoading={isLoading}
              hiddenFormFields={hiddenFields}
              requiredFormFields={requiredFields}
              omitRowWrapper
            />
            <PatientRecordFormField
              item={responsibleParty.state}
              isLoading={isLoading}
              hiddenFormFields={hiddenFields}
              requiredFormFields={requiredFields}
              omitRowWrapper
            />
            <PatientRecordFormField
              item={responsibleParty.zip}
              isLoading={isLoading}
              hiddenFormFields={hiddenFields}
              requiredFormFields={requiredFields}
              omitRowWrapper
            />
          </Box>
        </Row>
      </>
    </PatientRecordFormSection>
  );
};
