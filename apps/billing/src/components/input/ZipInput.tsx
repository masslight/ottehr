import { TextField } from '@mui/material';
import { ReactElement } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { InputMask } from 'ui-components/lib/components/InputMask';
import { isPostalCodeValid } from 'utils/lib/helpers/helpers';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';

interface ZipInputProps {
  name: string;
  label: string;
  required?: boolean;
  // Require ZIP+4 (XXXXX-XXXX) instead of accepting a bare 5-digit ZIP.
  requireFullZip?: boolean;
}

// US ZIP field masked as XXXXX-XXXX; an empty value passes unless `required` is set.
export function ZipInput({ name, label, required, requireFullZip }: ZipInputProps): ReactElement {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      rules={{
        required: required ? REQUIRED_FIELD_ERROR_MESSAGE : false,
        validate: (value: string | null) =>
          !value ||
          isPostalCodeValid(value, requireFullZip) ||
          `ZIP code must be 5 digits,${!requireFullZip ? ' optionally' : ''} with a 4-digit extension`,
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
          InputProps={{
            inputComponent: InputMask as any,
            inputProps: { mask: '00000-0000' },
          }}
        />
      )}
    />
  );
}
