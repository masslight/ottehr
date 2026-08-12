import { TextField, TextFieldProps } from '@mui/material';
import { forwardRef } from 'react';
import { InputMask } from 'ui-components';

export { isFaxNumberValid } from 'utils';

export const FAX_NUMBER_HELPER_TEXT = 'Fax number must be 10 digits in the format (xxx) xxx-xxxx and a valid number';

type FaxNumberFieldProps = Omit<TextFieldProps, 'onChange' | 'value'> & {
  value: string | undefined;
  /** Receives digits only; the mask is presentation. */
  onChange: (digits: string) => void;
};

/** Masked (xxx) xxx-xxxx entry shared by every fax dialog. */
export const FaxNumberField = forwardRef<HTMLInputElement, FaxNumberFieldProps>(
  ({ value, onChange, ...props }, ref) => (
    <TextField
      {...props}
      inputRef={ref}
      value={value ?? ''}
      placeholder="(XXX) XXX-XXXX"
      inputMode="numeric"
      InputProps={{
        ...props.InputProps,
        inputComponent: InputMask as any,
        inputProps: { mask: '(000) 000-0000' },
      }}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
    />
  )
);

FaxNumberField.displayName = 'FaxNumberField';
