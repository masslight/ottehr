import { TextField } from '@mui/material';
import { ReactElement } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { InputMask } from 'ui-components/lib/components/InputMask';
import { isPhoneNumberValid } from 'utils/lib/helpers/helpers';

interface PhoneInputProps {
  name: string;
  label: string;
  // Prefix of the validation message, e.g. 'Fax number'.
  fieldLabel?: string;
}

// Optional US phone/fax field: masked as (xxx) xxx-xxxx and validated only when a value is entered.
export function PhoneInput({ name, label, fieldLabel = 'Phone number' }: PhoneInputProps): ReactElement {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      rules={{
        validate: (value: string | null) =>
          !value || isPhoneNumberValid(value) || `${fieldLabel} must be 10 digits in the format (xxx) xxx-xxxx`,
      }}
      render={({ field: { ref, ...field }, fieldState: { error } }) => (
        <TextField
          {...field}
          value={field.value ?? ''}
          inputRef={ref}
          label={label}
          size="small"
          fullWidth
          placeholder="(555) 000-0000"
          error={!!error}
          helperText={error?.message}
          InputProps={{
            inputComponent: InputMask as any,
            inputProps: { mask: '(000) 000-0000' },
          }}
        />
      )}
    />
  );
}
