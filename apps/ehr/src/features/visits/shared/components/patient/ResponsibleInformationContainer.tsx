import { Box } from '@mui/material';
import { FC, useEffect, useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Row } from 'src/components/layout';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';
import { SectionSaveButton } from './SectionSaveButton';

const { responsibleParty: responsiblePartySection } = PATIENT_RECORD_CONFIG.FormFields;
const FIELD_KEYS = Object.values(responsiblePartySection.items).map((item) => item.key);
const BASE_REQUIRED_FIELD_KEYS = responsiblePartySection.requiredFields ?? [];

interface ResponsibleInformationContainerProps {
  isLoading: boolean;
  patientId?: string;
  encounterId?: string;
}

export const ResponsibleInformationContainer: FC<ResponsibleInformationContainerProps> = ({
  isLoading,
  patientId,
  encounterId,
}) => {
  const {
    items: responsibleParty,
    hiddenFields,
    requiredFields,
  } = usePatientRecordFormSection({ formSection: responsiblePartySection });

  const { setValue } = useFormContext();
  const noRPEmailChecked = useWatch({ name: 'responsible-party-no-email' });

  useEffect(() => {
    if (noRPEmailChecked) {
      setValue('responsible-party-email', '', { shouldDirty: true });
    }
  }, [noRPEmailChecked, setValue]);

  const effectiveRequiredFieldKeys = useMemo(
    () =>
      noRPEmailChecked
        ? BASE_REQUIRED_FIELD_KEYS.filter((k) => k !== 'responsible-party-email')
        : BASE_REQUIRED_FIELD_KEYS,
    [noRPEmailChecked]
  );

  const effectiveRequiredFields = useMemo(
    () => (noRPEmailChecked ? (requiredFields ?? []).filter((k) => k !== 'responsible-party-email') : requiredFields),
    [noRPEmailChecked, requiredFields]
  );

  const cityStateZipKeys = new Set(['responsible-party-zip', 'responsible-party-state', 'responsible-party-city']);
  const nonCityStateZipFields = Object.values(responsibleParty).filter((v) => !cityStateZipKeys.has(v.key));

  return (
    <PatientRecordFormSection
      formSection={responsiblePartySection}
      titleWidget={
        <SectionSaveButton
          fieldKeys={FIELD_KEYS}
          requiredFieldKeys={effectiveRequiredFieldKeys}
          patientId={patientId}
          encounterId={encounterId}
        />
      }
    >
      <>
        {nonCityStateZipFields.map((item) => (
          <PatientRecordFormField
            key={item.key}
            item={item}
            isLoading={isLoading}
            hiddenFormFields={hiddenFields}
            requiredFormFields={effectiveRequiredFields}
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
