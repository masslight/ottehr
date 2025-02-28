import { Box, Divider, MenuItem, Select, Typography, useTheme } from '@mui/material';
import { HumanName } from 'fhir/r4b';
import { FC, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import {
  PATIENT_COMMON_WELL_CONSENT_URL,
  PATIENT_ETHNICITY_URL,
  PATIENT_GENDER_IDENTITY_DETAILS_URL,
  PATIENT_GENDER_IDENTITY_URL,
  PATIENT_POINT_OF_DISCOVERY_URL,
  PATIENT_RACE_URL,
  PATIENT_SEND_MARKETING_URL,
  PATIENT_SEXUAL_ORIENTATION_URL,
  patientFieldPaths,
  REQUIRED_FIELD_ERROR_MESSAGE,
} from 'utils';
import {
  ETHNICITY_OPTIONS,
  GENDER_IDENTITY_OPTIONS,
  POINT_OF_DISCOVERY_OPTIONS,
  RACE_OPTIONS,
  SEXUAL_ORIENTATION_OPTIONS,
} from '../../constants';
import { getExtensionValue } from '../../features/css-module/parser';
import { FormSelect, FormTextField } from '../form';
import { Row, Section } from '../layout';
import ShowMoreButton from './ShowMoreButton';
import { usePatientStore } from '../../state/patient.store';

export const PatientDetailsContainer: FC = () => {
  const theme = useTheme();
  const { patient, updatePatientField } = usePatientStore();
  const { control, setValue, watch } = useFormContext();

  const [showAllPreviousNames, setShowAllPreviousNames] = useState(false);
  const genderIdentityCurrentValue = watch(patientFieldPaths.genderIdentity);

  if (!patient) return null;

  const howDidYouHearAboutUs = patient?.extension?.find(
    (e: { url: string }) => e.url === PATIENT_POINT_OF_DISCOVERY_URL
  )?.valueString;

  const sendMarketingMessages = patient?.extension?.find((e: { url: string }) => e.url === PATIENT_SEND_MARKETING_URL)
    ?.valueBoolean;

  const commonWellConsent = patient?.extension?.find((e: { url: string }) => e.url === PATIENT_COMMON_WELL_CONSENT_URL)
    ?.valueBoolean;

  const previousNames = patient.name?.filter((name) => name.use === 'old').reverse() || [];

  const preferredLanguage = patient.communication?.find((lang) => lang.preferred)?.language.coding?.[0].display;

  const sexualOrientation = patient?.extension?.find((e: { url: string }) => e.url === PATIENT_SEXUAL_ORIENTATION_URL)
    ?.valueCodeableConcept?.coding?.[0].display;

  const genderIdentity = patient?.extension?.find((e: { url: string }) => e.url === PATIENT_GENDER_IDENTITY_URL)
    ?.valueCodeableConcept?.coding?.[0].display;

  const genderIdentityDetails = patient?.extension?.find(
    (e: { url: string }) => e.url === PATIENT_GENDER_IDENTITY_DETAILS_URL
  )?.valueString;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = event.target;
    updatePatientField(name, value);
  };

  const handleGenderIdentityChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    handleChange(e as any);
    // Remove gender identity details if not selecting "Other"
    if (e.target.value !== 'Non-binary gender identity') {
      setValue(patientFieldPaths.genderIdentityDetails, '');
      updatePatientField(patientFieldPaths.genderIdentityDetails, '');
    }
  };

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
      <Row label="Patient's ethnicity" required>
        <FormSelect
          name={patientFieldPaths.ethnicity}
          control={control}
          options={ETHNICITY_OPTIONS}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
          }}
          defaultValue={getExtensionValue(patient, PATIENT_ETHNICITY_URL)}
          onChangeHandler={handleChange}
        />
      </Row>
      <Row label="Patient's race" required>
        <FormSelect
          name={patientFieldPaths.race}
          control={control}
          options={RACE_OPTIONS}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
          }}
          defaultValue={getExtensionValue(patient, PATIENT_RACE_URL)}
          onChangeHandler={handleChange}
        />
      </Row>
      <Row label="Sexual orientation">
        <FormSelect
          name={patientFieldPaths.sexualOrientation}
          control={control}
          options={SEXUAL_ORIENTATION_OPTIONS}
          defaultValue={sexualOrientation}
          onChangeHandler={handleChange}
        />
      </Row>
      <Row label="Gender identity">
        <FormSelect
          name={patientFieldPaths.genderIdentity}
          control={control}
          options={GENDER_IDENTITY_OPTIONS}
          defaultValue={genderIdentity}
          onChangeHandler={handleGenderIdentityChange}
        />
      </Row>
      {genderIdentityCurrentValue === 'Non-binary gender identity' && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '5px',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', alignSelf: 'end', flex: '0 1 70%' }}>
            <FormTextField
              name={patientFieldPaths.genderIdentityDetails}
              control={control}
              defaultValue={genderIdentityDetails}
              onChangeHandler={handleChange}
            />
          </Box>
        </Box>
      )}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '5px',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', flex: '0 1 30%' }}>
          <Typography sx={{ color: theme.palette.primary.dark }}>How did you hear about us?</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', flex: '1 1 70%' }}>
          <Controller
            name={patientFieldPaths.pointOfDiscovery}
            control={control}
            defaultValue={howDidYouHearAboutUs || ''}
            render={({ field }) => (
              <Select
                {...field}
                value={field.value || ''}
                variant="standard"
                sx={{ width: '100%' }}
                onChange={(e) => {
                  field.onChange(e);
                  handleChange(e as any);
                }}
              >
                {POINT_OF_DISCOVERY_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
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
          <Typography sx={{ color: theme.palette.primary.dark }}>Send marketing messages</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', flex: '1 1 70%' }}>
          <Controller
            name={patientFieldPaths.sendMarketing}
            control={control}
            defaultValue={sendMarketingMessages === undefined ? '' : String(sendMarketingMessages)}
            render={({ field }) => (
              <Select
                {...field}
                value={field.value || ''}
                variant="standard"
                sx={{ width: '100%' }}
                onChange={(e) => {
                  field.onChange(e);
                  handleChange(e as any);
                }}
              >
                {[
                  { value: true, label: 'Yes' },
                  { value: false, label: 'No' },
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
            name={patientFieldPaths.preferredLanguage}
            control={control}
            defaultValue={preferredLanguage || ''}
            render={({ field }) => (
              <Select
                {...field}
                value={field.value || ''}
                variant="standard"
                sx={{ width: '100%' }}
                onChange={(e) => {
                  field.onChange(e);
                  handleChange(e as any);
                }}
              >
                {[
                  {
                    label: 'English',
                    value: 'English',
                  },
                  {
                    label: 'Spanish',
                    value: 'Spanish',
                  },
                ].map((option) => (
                  <MenuItem key={option.value} value={option.value}>
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
          <Typography sx={{ color: theme.palette.primary.dark }}>CommonWell consent</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', flex: '1 1 70%' }}>
          <Controller
            name={patientFieldPaths.commonWellConsent}
            control={control}
            defaultValue={commonWellConsent === undefined ? '' : String(commonWellConsent)}
            render={({ field }) => (
              <Select
                {...field}
                value={field.value || ''}
                variant="standard"
                sx={{ width: '100%' }}
                onChange={(e) => {
                  field.onChange(e);
                  handleChange(e as any);
                }}
              >
                {[
                  { value: true, label: 'Yes' },
                  { value: false, label: 'No' },
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
