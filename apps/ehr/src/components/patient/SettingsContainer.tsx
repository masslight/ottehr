import {
  Box,
  Checkbox,
  FormControlLabel,
  TextField,
  Typography,
  RadioGroup,
  Radio,
  FormControl,
  MenuItem,
  Select,
  FormHelperText,
} from '@mui/material';
import { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import {
  createLocalDateTime,
  PATIENT_DECEASED_NOTE_URL,
  PATIENT_RELEASE_OF_INFO_URL,
  PATIENT_RX_HISTORY_CONSENT_STATUS_URL,
  patientFieldPaths,
  REQUIRED_FIELD_ERROR_MESSAGE,
} from 'utils';
import { RX_HISTORY_CONSENT_OPTIONS } from '../../constants';
import { BasicDatePicker as DatePicker, FormSelect } from '../form';
import { Row, Section } from '../layout';
import { usePatientStore } from '../../state/patient.store';

export const SettingsContainer: FC = () => {
  const { patient, updatePatientField } = usePatientStore();
  const { control, watch, setValue } = useFormContext();

  if (!patient) return null;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value, type, checked } = event.target;
    updatePatientField(name, type === 'checkbox' ? checked : value);
  };

  const releaseOfInfo = patient?.extension?.find((e: { url: string }) => e.url === PATIENT_RELEASE_OF_INFO_URL)
    ?.valueBoolean;

  const rxHistoryConsentStatus = patient?.extension?.find(
    (e: { url: string }) => e.url === PATIENT_RX_HISTORY_CONSENT_STATUS_URL
  )?.valueString;

  const deceasedNote = patient?.extension?.find((e: { url: string }) => e.url === PATIENT_DECEASED_NOTE_URL)
    ?.valueString;

  const deceased = watch(patientFieldPaths.deceased);
  const deceasedDate = watch(patientFieldPaths.deceasedDate);

  return (
    <Section title="User settings">
      <Row label="Release of info" required>
        <Controller
          name={patientFieldPaths.releaseOfInfo}
          control={control}
          defaultValue={releaseOfInfo === undefined ? '' : String(releaseOfInfo)}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          render={({ field, fieldState: { error } }) => (
            <Box sx={{ width: '100%' }}>
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
                  { value: true, label: 'Yes, Release Allowed' },
                  { value: false, label: 'No, Release Not Allowed' },
                ].map((option) => (
                  <MenuItem key={String(option.value)} value={String(option.value)}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
              {error && <FormHelperText error={true}>{error?.message}</FormHelperText>}
            </Box>
          )}
        />
      </Row>
      <Row label="Rx History Consent" required>
        <FormSelect
          name={patientFieldPaths.rxHistoryConsentStatus}
          control={control}
          defaultValue={rxHistoryConsentStatus}
          options={RX_HISTORY_CONSENT_OPTIONS}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
            validate: (value: string) => RX_HISTORY_CONSENT_OPTIONS.some((option) => option.value === value),
          }}
          onChangeHandler={handleChange}
        />
      </Row>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '5px',
        }}
      >
        <Controller
          name={patientFieldPaths.active}
          control={control}
          defaultValue={patient?.active ?? true}
          render={({ field: { onChange, value, ...field } }) => (
            <FormControlLabel
              control={
                <Checkbox
                  {...field}
                  checked={!value}
                  onChange={(e) => {
                    const newActiveValue = !e.target.checked;
                    onChange(newActiveValue);
                    handleChange({
                      ...e,
                      target: {
                        ...e.target,
                        type: e.target.type,
                        name: patientFieldPaths.active,
                        checked: newActiveValue,
                      },
                    });
                  }}
                />
              }
              label={<Typography>Inactive</Typography>}
            />
          )}
        />
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '5px',
          }}
        >
          <Controller
            name={patientFieldPaths.deceased}
            control={control}
            defaultValue={patient?.deceasedBoolean || Boolean(patient?.deceasedDateTime)}
            render={({ field: { onChange, value, ...field } }) => (
              <FormControlLabel
                control={
                  <Checkbox
                    {...field}
                    checked={value}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      onChange(isChecked);
                      handleChange(e);

                      if (!isChecked) {
                        if (deceasedDate) {
                          updatePatientField(patientFieldPaths.deceasedDate, '');
                          setValue(patientFieldPaths.deceasedDate, '');
                        }
                      } else {
                        setValue('deceasedDateType', 'unknown');
                      }
                    }}
                  />
                }
                label={<Typography>Deceased</Typography>}
              />
            )}
          />
        </Box>
        {deceased && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, px: 3 }}>
            <FormControl>
              <Controller
                name="deceasedDateType"
                control={control}
                defaultValue={patient?.deceasedDateTime ? 'known' : 'unknown'}
                render={({ field }) => (
                  <RadioGroup
                    {...field}
                    value={field.value}
                    onChange={(e) => {
                      field.onChange(e);
                      const isDateKnown = e.target.value === 'known';
                      if (isDateKnown) {
                        updatePatientField(patientFieldPaths.deceasedDate, '');
                      } else {
                        updatePatientField(patientFieldPaths.deceasedDate, '');
                        updatePatientField(patientFieldPaths.deceased, true);
                        setValue(patientFieldPaths.deceasedDate, '');
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <FormControlLabel
                        value="known"
                        control={<Radio />}
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography sx={{ flex: 'none' }}>Deceased Date</Typography>
                            <DatePicker
                              name={patientFieldPaths.deceasedDate}
                              control={control}
                              disabled={field.value === 'unknown'}
                              required={field.value === 'known'}
                              variant="outlined"
                              defaultValue={patient?.deceasedDateTime}
                              onChange={(dateStr) => {
                                const isoDateTime = createLocalDateTime(dateStr)?.toISO?.();
                                if (isoDateTime) {
                                  updatePatientField(patientFieldPaths.deceased, '');
                                  updatePatientField(patientFieldPaths.deceasedDate, isoDateTime);
                                }
                              }}
                            />
                          </Box>
                        }
                      />
                    </Box>
                    <FormControlLabel
                      value="unknown"
                      control={<Radio />}
                      label={<Typography>Date Unknown</Typography>}
                    />
                  </RadioGroup>
                )}
              />
            </FormControl>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: '5px' }}>
              <Controller
                name={patientFieldPaths.deceasedNote}
                control={control}
                defaultValue={deceasedNote || ''}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      field.onChange(e);
                      handleChange(e);
                    }}
                    label="Note"
                    fullWidth
                    InputLabelProps={{
                      shrink: true,
                      sx: {
                        fontWeight: 'bold',
                      },
                    }}
                  />
                )}
              />
            </Box>
          </Box>
        )}
      </Box>
    </Section>
  );
};
