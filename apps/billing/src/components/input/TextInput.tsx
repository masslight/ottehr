import { SxProps, TextField, TextFieldProps, Theme } from '@mui/material';
import { ReactElement } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';

interface TextInputProps {
  name: string;
  label?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  fullWidth?: boolean;
  sx?: SxProps<Theme>;
  InputLabelProps?: TextFieldProps['InputLabelProps'];
}

/**
 * react-hook-form-bound text field, mirroring the clinical side's
 * apps/ehr/src/components/input/TextInput.tsx: it registers a `required` rule using the
 * shared REQUIRED_FIELD_ERROR_MESSAGE and renders the error state inline (red + helper text).
 * The `sx`/width is applied to the field itself so it drops into the existing flex layouts.
 */
export function TextInput({
  name,
  label,
  type,
  required,
  placeholder,
  fullWidth,
  sx,
  InputLabelProps,
}: TextInputProps): ReactElement {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      rules={{ required: required ? REQUIRED_FIELD_ERROR_MESSAGE : false }}
      render={({ field, fieldState: { error } }) => (
        <TextField
          {...field}
          value={field.value ?? ''}
          size="small"
          type={type ?? 'text'}
          label={label}
          placeholder={placeholder}
          error={!!error}
          helperText={error?.message}
          fullWidth={fullWidth}
          InputLabelProps={InputLabelProps}
          sx={sx}
        />
      )}
    />
  );
}
