import { FormControl, InputProps, TextField, useTheme } from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CustomAdapterLuxon } from '../helpers';
import i18n from '../lib/i18n';
import { focusStyling, otherColors } from '../OttEHRThemeProvider';
import { BoldPrimaryInputLabel } from './BoldPrimaryInputLabel';
import { InputHelperText } from './InputHelperText';

type DateInputProps = {
  helperText?: string;
  label: string;
  name: string;
  required?: boolean;
} & InputProps;

export const DateInput: FC<DateInputProps> = ({ defaultValue, helperText, label, name, required }) => {
  const {
    control,
    formState: { errors },
  } = useFormContext();
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Controller
      control={control}
      defaultValue={defaultValue || ''}
      name={name}
      render={({ field: { onChange, value } }) => (
        <FormControl
          error={!!errors[name]}
          required={required}
          variant="standard"
          sx={{
            width: '100%',
          }}
        >
          <LocalizationProvider adapterLocale={i18n.language} dateAdapter={CustomAdapterLuxon}>
            <BoldPrimaryInputLabel htmlFor={`${name}-label`} shrink>
              {label}
            </BoldPrimaryInputLabel>
            <DatePicker
              disableFuture
              inputFormat="MM/dd/yyyy"
              onChange={onChange}
              renderInput={(params) => (
                <TextField
                  {...params}
                  error={!!errors[name]}
                  fullWidth
                  id={`${name}-label`}
                  inputProps={{
                    ...params.inputProps,
                    placeholder: t('general.datePlaceholder'),
                  }}
                  required={required}
                  size="small"
                  sx={{
                    fieldset: {
                      borderColor: otherColors.lightGray,
                      borderRadius: '8px',
                      transition: theme.transitions.create(['border-color', 'background-color', 'box-shadow']),
                    },
                    input: {
                      fontSize: 16,
                      padding: '10px 12px',
                    },
                    mt: 2,
                    '.Mui-focused fieldset': focusStyling,
                    '.MuiFormHelperText-root': {
                      ml: 1,
                    },
                    ':hover fieldset': {
                      borderColor: `${otherColors.lightGray} !important`,
                    },
                  }}
                />
              )}
              value={value}
            />
          </LocalizationProvider>
          <InputHelperText errors={errors} helperText={helperText} name={name} />
        </FormControl>
      )}
    />
  );
};
