import CancelIcon from '@mui/icons-material/Cancel';
import CheckIcon from '@mui/icons-material/CheckCircle';
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { Control, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { getSlugAvailability } from '../api';
import { createSlugUrl } from '../helpers';
import { useDebounce } from '../hooks';
import { CustomButton } from './CustomButton';
import { ReturnErrorMessage } from './ReturnErrorMessage';
import { getProvider, getTitles } from '../helpers/mockData';

interface ProviderFieldsProps {
  buttonText: string;
  control: Control<any, any>;
  errors: any;
  isRegister?: boolean;
  onSubmit?: (prop: any) => any;
}
export const ProviderFields: FC<ProviderFieldsProps> = ({ buttonText, control, errors, isRegister, onSubmit }) => {
  const { t } = useTranslation();
  // TODO hard-coded data
  const provider = getProvider();
  const [slug, setSlug] = useState(provider.slug);
  const [slugError, setSlugError] = useState('');

  const debouncedUpdateSlug = useDebounce(async () => {
    const { error, response } = await getSlugAvailability(slug);
    let errorMessage: string | undefined;
    if (error) {
      errorMessage = ReturnErrorMessage(error);
      setSlugError(errorMessage);
    }
    if (response?.available) {
      setSlugError('');
    } else {
      setSlugError(t('error.slugUnavailable'));
    }
  }, 1000);
  useEffect(() => {
    if (slug === '') {
      setSlugError("Slug can't be an empty string.");
    } else {
      debouncedUpdateSlug();
    }
  }, [debouncedUpdateSlug, slug]);

  const titles = getTitles();

  return (
    <form onSubmit={onSubmit}>
      <Box sx={{ alignItems: 'left', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/*
          TODO form labels translated without breaking react hook form/back end submission.
          TODO react hook form for all fields
        */}
        <Controller
          control={control}
          name="title"
          render={({ field }) => (
            <FormControl variant="outlined">
              <InputLabel>Title</InputLabel>
              <Select label="Title" {...field}>
                {titles.map((title) => (
                  <MenuItem key={title} value={title.toLowerCase()}>
                    {t(`profile.titleOption.${title.toLowerCase()}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        />
        <Controller
          control={control}
          name="firstName"
          render={({ field }) => (
            <TextField
              {...field}
              helperText={errors.firstName ? String(errors.firstName.message) : null}
              label="First Name"
              variant="outlined"
            />
          )}
        />
        <Controller
          control={control}
          name="lastName"
          render={({ field }) => (
            <TextField
              {...field}
              helperText={errors.lastName ? String(errors.lastName.message) : null}
              label="Last Name"
              variant="outlined"
            />
          )}
        />
        <Controller
          control={control}
          name="slug"
          render={({ field }) => (
            <>
              <TextField
                error={slugError.length > 0}
                helperText={slugError}
                label="Slug"
                onChange={(e) => {
                  setSlug(e.target.value);
                  field.onChange(e);
                }}
                value={slug ?? ''}
                variant="outlined"
              />
              <Box mb={-0.5} mt={-1} sx={{ alignItems: 'center', display: 'flex' }}>
                <Box sx={{ mr: 1 }}>
                  {slugError === '' ? <CheckIcon color="success" /> : <CancelIcon color="error" />}
                </Box>
                <Typography variant="body2">{createSlugUrl(field.value)}</Typography>
              </Box>
            </>
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field }) => <TextField {...field} label="Email Address" variant="outlined" />}
        />
        {isRegister && (
          <>
            <Controller
              control={control}
              name="password"
              render={({ field }) => <TextField {...field} label="Password" type="password" variant="outlined" />}
            />
            <Controller
              control={control}
              defaultValue={false}
              name="notPatient"
              render={({ field: { onChange, value } }) => (
                <FormControlLabel
                  control={<Checkbox checked={value} onChange={onChange} />}
                  label="I am not a patient"
                  sx={{ mb: -0.5 }}
                />
              )}
            />
            <Controller
              control={control}
              defaultValue={false}
              name="acceptTerms"
              render={({ field: { onChange, value } }) => (
                <FormControlLabel
                  control={<Checkbox checked={value} onChange={onChange} />}
                  label="I accept the terms and conditions"
                />
              )}
            />
          </>
        )}
        <CustomButton submit sx={{ mt: 0 }}>
          {buttonText}
        </CustomButton>
      </Box>
    </form>
  );
};
