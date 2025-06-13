import { Box, Divider, MenuItem, Select, Typography, useTheme } from '@mui/material';
import { HumanName, Patient } from 'fhir/r4b';
import { FC, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { LANGUAGE_OPTIONS, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import {
  ETHNICITY_OPTIONS,
  GENDER_IDENTITY_OPTIONS,
  POINT_OF_DISCOVERY_OPTIONS,
  RACE_OPTIONS,
  SEXUAL_ORIENTATION_OPTIONS,
} from '../../constants';
import { FormSelect, FormTextField } from '../form';
import { Row, Section } from '../layout';
import ShowMoreButton from './ShowMoreButton';
import { dataTestIds } from '../../constants/data-test-ids';
import { FormFields as AllFormFields } from '../../constants';

const FormFields = AllFormFields.patientDetails;
interface PatientDetailsContainerProps {
  patient: Patient;
}
export const PatientDetailsContainer: FC<PatientDetailsContainerProps> = ({ patient }) => {
  const theme = useTheme();
  const { control, watch } = useFormContext();

  const [showAllPreviousNames, setShowAllPreviousNames] = useState(false);

  if (!patient) return null;

  const previousNames = patient.name?.filter((name) => name.use === 'old').reverse() || [];

  const genderIdentityCurrentValue = watch(FormFields.genderIdentity.key);
  const isNonBinaryGender = genderIdentityCurrentValue === 'Non-binary gender identity';

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
      <Row label="Patient's ethnicity" dataTestId={dataTestIds.patientDetailsContainer.patientsEthnicity} required>
        <FormSelect
          name={FormFields.ethnicity.key}
          control={control}
          options={ETHNICITY_OPTIONS}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
          }}
        />
      </Row>
      <Row label="Patient's race" dataTestId={dataTestIds.patientDetailsContainer.patientsRace} required>
        <FormSelect
          name={FormFields.race.key}
          control={control}
          options={RACE_OPTIONS}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
          }}
        />
      </Row>
      <Row label="Sexual orientation" dataTestId={dataTestIds.patientDetailsContainer.sexualOrientation}>
        <FormSelect name={FormFields.sexualOrientation.key} control={control} options={SEXUAL_ORIENTATION_OPTIONS} />
      </Row>
      <Row label="Gender identity" dataTestId={dataTestIds.patientDetailsContainer.genderIdentity}>
        <FormSelect name={FormFields.genderIdentity.key} control={control} options={GENDER_IDENTITY_OPTIONS} />
      </Row>
      {isNonBinaryGender && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '5px',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', alignSelf: 'end', flex: '0 1 70%' }}>
            <FormTextField
              name={FormFields.genderIdentityDetails.key}
              data-testid={dataTestIds.patientDetailsContainer.pleaseSpecifyField}
              control={control}
              rules={{
                validate: (value: string) => {
                  if (!value && isNonBinaryGender) return REQUIRED_FIELD_ERROR_MESSAGE;
                  return true;
                },
              }}
            />
          </Box>
        </Box>
      )}
      <Row label="How did you hear about us?" dataTestId={dataTestIds.patientDetailsContainer.howDidYouHearAboutUs}>
        <FormSelect name={FormFields.pointOfDiscovery.key} control={control} options={POINT_OF_DISCOVERY_OPTIONS} />
      </Row>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '5px',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', flex: '0 1 30%' }}>
          <Typography sx={{ color: theme.palette.primary.dark }}>Send marketing messages</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', flex: '1 1 70%' }}>
          <Controller
            name={FormFields.sendMarketing.key}
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                value={String(field.value) || ''}
                variant="standard"
                sx={{ width: '100%' }}
                onChange={(e) => {
                  const boolValue = e.target.value === 'true';
                  field.onChange(boolValue);
                }}
                data-testid={dataTestIds.patientDetailsContainer.sendMarketingMessages}
              >
                {[
                  { value: 'true', label: 'Yes' },
                  { value: 'false', label: 'No' },
                ].map((option) => (
                  <MenuItem key={String(option.value)} value={String(option.value)}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            )}
          />
        </Box>
      </Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '5px',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', flex: '0 1 30%' }}>
          <Typography sx={{ color: theme.palette.primary.dark }}>Preferred language</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', flex: '1 1 70%' }}>
          <Controller
            name={FormFields.language.key}
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                value={field.value || ''}
                variant="standard"
                sx={{ width: '100%' }}
                data-testid={dataTestIds.patientDetailsContainer.preferredLanguage}
              >
                {Object.entries(LANGUAGE_OPTIONS).map(([key, value]) => (
                  <MenuItem key={value} value={value}>
                    {key}
                  </MenuItem>
                ))}
              </Select>
            )}
          />
        </Box>
      </Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '5px',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', flex: '0 1 30%' }}>
          <Typography sx={{ color: theme.palette.primary.dark }}>CommonWell consent</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', flex: '1 1 70%' }}>
          <Controller
            name={FormFields.commonWellConsent.key}
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                value={String(field.value) || ''}
                variant="standard"
                sx={{ width: '100%' }}
                onChange={(e) => {
                  const boolValue = e.target.value === 'true';
                  field.onChange(boolValue);
                }}
                data-testid={dataTestIds.patientDetailsContainer.commonWellConsent}
              >
                {[
                  { value: 'true', label: 'Yes' },
                  { value: 'false', label: 'No' },
                ].map((option) => (
                  <MenuItem key={String(option.value)} value={String(option.value)}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            )}
          />
        </Box>
      </Box>
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
