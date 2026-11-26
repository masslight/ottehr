import { Box, InputBaseComponentProps, InputProps, Skeleton, TextField } from '@mui/material';
import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';

type Props = {
  name: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'number';
  loading?: boolean;
  required?: boolean;
  multiline?: boolean;
  validate?: (value: string) => boolean | string;
  inputProps?: InputBaseComponentProps;
  InputProps?: InputProps;
  dataTestId?: string;
  disabled?: boolean;
  helperText?: string;
};

export const TextInput: React.FC<Props> = ({
  name,
  label,
  placeholder,
  type,
  loading,
  required,
  multiline,
  validate,
  inputProps,
  InputProps,
  dataTestId,
  disabled,
  helperText,
}) => {
  const { control } = useFormContext();
  return !loading ? (
    <Controller
      name={name}
      control={control}
      defaultValue=""
      rules={{
        required: required ? REQUIRED_FIELD_ERROR_MESSAGE : required,
        validate,
      }}
      render={({ field, fieldState: { error } }) => (
        <Box sx={{ width: '100%' }}>
          <TextField
            value={field.value}
            label={label + (required ? '*' : '')}
            placeholder={placeholder ?? label}
            type={type ?? 'text'}
            error={error != null}
            onChange={(data) => field.onChange(data)}
            multiline={multiline}
            autoComplete="off"
            variant="outlined"
            size="small"
            inputProps={inputProps}
            InputProps={InputProps}
            fullWidth
            disabled={disabled}
            data-testid={dataTestId}
            helperText={error ? error.message : helperText}
            FormHelperTextProps={{ sx: { mx: 0 } }}
          />
        </Box>
      )}
    />
  ) : (
    <Skeleton variant="rectangular" width="100%" height={56} />
  );
};
