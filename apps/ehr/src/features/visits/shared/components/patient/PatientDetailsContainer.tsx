import { Box, Divider, Stack, Typography, useTheme } from '@mui/material';
import { HumanName, Patient } from 'fhir/r4b';
import { FC, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Row, Section } from 'src/components/layout';
import { PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordFormField from './PatientRecordFormField';
import { usePatientRecordFormSection } from './PatientRecordFormSection';
import ShowMoreButton from './ShowMoreButton';

const patientDetailsSection = PATIENT_RECORD_CONFIG.FormFields.patientDetails;
interface PatientDetailsContainerProps {
  patient: Patient;
  isLoading: boolean;
}
export const PatientDetailsContainer: FC<PatientDetailsContainerProps> = ({ patient, isLoading }) => {
  const theme = useTheme();
  const { watch } = useFormContext();

  const {
    items: FormFields,
    hiddenFields,
    requiredFields,
  } = usePatientRecordFormSection({ formSection: patientDetailsSection });

  const [showAllPreviousNames, setShowAllPreviousNames] = useState(false);

  if (!patient) return null;

  const previousNames = patient.name?.filter((name) => name.use === 'old').reverse() || [];

  const genderIdentityCurrentValue = watch(FormFields.genderIdentity.key);
  console.log('genderIdentityCurrentValue');
  // todo: this needs to come from config/value sets
  const isNonBinaryGender = genderIdentityCurrentValue === 'Non-binary gender identity';
  const languageValue = watch(FormFields.language.key);

  if (isNonBinaryGender) {
    requiredFields.push(FormFields.genderIdentityDetails.key);
  }

  /*
  todo - move this into value sets config
  const questionnaireLanguageOptions =
    (
      Object.values(inPersonIntakeQuestionnaire.fhirResources)[0]
        .resource.item.find((item) => item.linkId === 'patient-details-page')
        ?.item.find((item) => item.linkId === 'preferred-language') as QuestionnaireItem | undefined
    )?.answerOption?.map((option) => option.valueString) ?? [];

    */

  return (
    <Section title="Patient details">
      <Row label="Previous name">
        {previousNames.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, width: '100%' }}>
            <Box sx={{ width: '100%' }}>
              <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                <Typography component="span">{formatFullName(previousNames[0])}</Typography>
                {previousNames.length > 1 && (
                  <ShowMoreButton
                    isOpen={showAllPreviousNames}
                    onClick={() => setShowAllPreviousNames(!showAllPreviousNames)}
                  />
                )}
              </Box>
              <Divider />
            </Box>
            {showAllPreviousNames &&
              previousNames.length > 1 &&
              previousNames.slice(1).map((name, index) => (
                <Box key={index} sx={{ width: '100%' }}>
                  <Typography sx={{ pb: 0.5 }}>{formatFullName(name)}</Typography>
                  <Divider />
                </Box>
              ))}
          </Box>
        ) : (
          <Typography color="text.secondary">No previous names</Typography>
        )}
      </Row>
      <PatientRecordFormField
        item={FormFields.ethnicity}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
      <PatientRecordFormField
        item={FormFields.race}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
      <PatientRecordFormField
        item={FormFields.sexualOrientation}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
      <PatientRecordFormField
        item={FormFields.genderIdentity}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
      {isNonBinaryGender && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '5px',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', alignSelf: 'end', flex: '0 1 70%' }}>
            <PatientRecordFormField
              item={FormFields.genderIdentityDetails}
              isLoading={isLoading}
              hiddenFormFields={hiddenFields}
              requiredFormFields={requiredFields}
              omitRowWrapper
            />
          </Box>
        </Box>
      )}
      <PatientRecordFormField
        item={FormFields.pointOfDiscovery}
        isLoading={isLoading}
        hiddenFormFields={hiddenFields}
        requiredFormFields={requiredFields}
      />
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '5px',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', flex: '0 1 30%' }}>
          <Typography sx={{ color: theme.palette.primary.dark }}>{FormFields.language.label}</Typography>
        </Box>
        <Stack sx={{ display: 'flex', alignItems: 'center', flex: '1 1 70%' }}>
          <Box width="100%">
            <PatientRecordFormField
              item={FormFields.language}
              isLoading={isLoading}
              hiddenFormFields={hiddenFields}
              requiredFormFields={requiredFields}
              omitRowWrapper
            />
          </Box>
          {languageValue === 'Other' ? (
            <Box width="100%">
              <PatientRecordFormField
                item={FormFields.otherLanguage}
                isLoading={isLoading}
                hiddenFormFields={hiddenFields}
                requiredFormFields={requiredFields}
                omitRowWrapper
              />
            </Box>
          ) : null}
        </Stack>
      </Box>
      <Row label={'Consents'}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            width: '100%',
            justifyContent: 'space-between',
            paddingTop: '10px',
          }}
        >
          <PatientRecordFormField
            item={FormFields.commonWellConsent}
            isLoading={isLoading}
            hiddenFormFields={hiddenFields}
            requiredFormFields={requiredFields}
            omitRowWrapper
          />
          <PatientRecordFormField
            item={FormFields.sendMarketing}
            isLoading={isLoading}
            hiddenFormFields={hiddenFields}
            requiredFormFields={requiredFields}
            omitRowWrapper
          />
        </Box>
      </Row>
    </Section>
  );
};

const formatFullName = (name: HumanName): string => {
  const components = [
    name.given?.join(' '), // Combines all given names (first + middle)
    name.family,
    name.suffix?.join(' '), // Combines all suffixes
  ].filter(Boolean); // Remove any undefined/null values

  return components.join(' ');
};
