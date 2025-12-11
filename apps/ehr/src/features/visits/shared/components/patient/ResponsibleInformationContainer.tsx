import { Box } from '@mui/material';
import { FC } from 'react';
import { Row } from 'src/components/layout';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';

const { responsibleParty: responsiblePartySection } = PATIENT_RECORD_CONFIG.FormFields;

export const ResponsibleInformationContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const {
    items: responsibleParty,
    hiddenFields,
    requiredFields,
  } = usePatientRecordFormSection({ formSection: responsiblePartySection });
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
