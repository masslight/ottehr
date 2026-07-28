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
      render={({ field: { ref, ...field }, fieldState: { error } }) => (
        <TextField
          {...field}
          value={field.value ?? ''}
          inputRef={ref}
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
