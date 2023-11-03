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
import { t } from 'i18next';
import { FC, useState } from 'react';
import { Control, Controller } from 'react-hook-form';
import { CustomButton } from './CustomButton';
import { getProvider, getTitles, isAvailable } from '../helpers/mockData';

interface ProviderFieldsProps {
  buttonText: string;
  control: Control<any, any>;
  errors: any;
  isRegister?: boolean;
  onSubmit?: (prop: any) => any;
}
export const ProviderFields: FC<ProviderFieldsProps> = ({ buttonText, control, errors, isRegister, onSubmit }) => {
  // TODO hard-coded data
  const provider = getProvider();
  const [slug, setSlug] = useState(provider.slug);
  const titles = getTitles();
  const isError = !isAvailable(slug);
  const helperText = isError ? t('error.slugUnavailable') : '';

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
                error={isError}
                helperText={helperText}
                label="Slug"
                onChange={(e) => {
                  setSlug(e.target.value);
                  field.onChange(e);
                }}
                variant="outlined"
              />
              <Box mb={-0.5} mt={-1} sx={{ alignItems: 'center', display: 'flex' }}>
                <Box sx={{ mr: 1 }}>{isError ? <CancelIcon color="error" /> : <CheckIcon color="success" />}</Box>
                <Typography variant="body2">{`https://zapehr.app/${field.value}`}</Typography>
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
