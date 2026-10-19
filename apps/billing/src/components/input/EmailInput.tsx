import { TextField } from '@mui/material';
import { ReactElement } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailInputProps {
  name: string;
  label: string;
}

// Optional email field, validated only when a value is entered.
export function EmailInput({ name, label }: EmailInputProps): ReactElement {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      rules={{
        validate: (value: string | null) => !value || EMAIL_REGEX.test(value.trim()) || 'Invalid email address',
      }}
      render={({ field: { ref, ...field }, fieldState: { error } }) => (
        <TextField
          {...field}
          value={field.value ?? ''}
          inputRef={ref}
          label={label}
          size="small"
          fullWidth
          error={!!error}
          helperText={error?.message}
        />
      )}
    />
  );
}
