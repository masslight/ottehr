import { FC, useContext } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { alpha, FormControl, InputProps, TextField, useTheme } from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { IntakeThemeContext } from '../../contexts';
import { CustomAdapterLuxon } from '../../helpers';
import { BoldPurpleInputLabel } from './BoldPurpleInputLabel';
import { InputHelperText } from './InputHelperText';
import { DateTime } from 'luxon';

type DateInputProps = {
  name: string;
  label: string;
  helperText?: string;
  required?: boolean;
} & InputProps;

const DateInput: FC<DateInputProps> = ({ name, label, helperText, required, defaultValue }) => {
  const {
    control,
    formState: { errors },
  } = useFormContext();
  const theme = useTheme();
  const { otherColors, i18n } = useContext(IntakeThemeContext);
  const { t } = useTranslation();

  if (typeof defaultValue === 'string') {
    defaultValue = DateTime.fromFormat(defaultValue, 'yyyy-MM-dd');
  }

  return (
    <Controller
      control={control}
      name={name}
      defaultValue={defaultValue || ''}
      render={({ field: { onChange, value } }) => (
        <FormControl
          variant="standard"
          error={!!errors[name]}
          required={required}
          sx={{
            width: '100%',
          }}
        >
          <LocalizationProvider adapterLocale={i18n.language} dateAdapter={CustomAdapterLuxon}>
            <BoldPurpleInputLabel htmlFor={name} shrink>
              {label}
            </BoldPurpleInputLabel>
            <DatePicker
              value={value}
              disableFuture
              onChange={onChange}
              inputFormat="MM/dd/yyyy"
              renderInput={(params) => (
                // todo remove code duplication with FormInput
                <TextField
                  id={name}
                  {...params}
                  fullWidth
                  inputProps={{
                    ...params.inputProps,
                    placeholder: t('general.datePlaceholder'),
                  }}
                  required={required}
                  size="small"
                  error={!!errors[name]}
                  sx={{
                    mt: 2,
                    '.MuiFormHelperText-root': {
                      ml: 1,
                    },
                    fieldset: {
                      transition: theme.transitions.create(['border-color', 'background-color', 'box-shadow']),
                      borderRadius: '8px',
                      borderColor: otherColors.lightGray,
                    },
                    ':hover fieldset': {
                      borderColor: `${otherColors.lightGray} !important`,
                    },
                    input: {
                      padding: '10px 12px',
                      fontSize: 16,
                    },
                    '.Mui-focused fieldset': {
                      border: '1px solid !important',
                      borderColor: `${theme.palette.primary.main} !important`,
                      boxShadow: `${alpha(theme.palette.primary.main, 0.25)} 0 0 0 0.2rem`,
                    },
                  }}
                />
              )}
            />
          </LocalizationProvider>
          <InputHelperText name={name} errors={errors} helperText={helperText} />
        </FormControl>
      )}
    />
  );
};

export default DateInput;
