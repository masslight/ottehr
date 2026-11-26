import { InputAdornment, TextField } from '@mui/material';
import { ReactElement } from 'react';
import { Control, Controller, FieldPathByValue, FieldValues } from 'react-hook-form';
import { formatCurrency } from 'utils/lib/utils/convert';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

export const toAmountInCents = (amount: string): number => Math.round(Number(amount.trim()) * 100);

export const STRIPE_MINIMUM_CHARGE_IN_CENTS = 50;

export function PaymentAmountField<TForm extends FieldValues>({
  control,
  name,
  minInCents,
  maxInCents,
  disabled = false,
}: {
  control: Control<TForm>;
  name: FieldPathByValue<TForm, string>;
  minInCents?: number;
  maxInCents?: number;
  disabled?: boolean;
}): ReactElement {
  return (
    <Controller
      name={name}
      control={control}
      rules={{
        required: REQUIRED_FIELD_ERROR_MESSAGE,
        validate: (value: string) => {
          if (!AMOUNT_PATTERN.test(value.trim()) || Number(value) <= 0) {
            return 'Enter an amount greater than $0 with at most 2 decimal places';
          }
          if (minInCents !== undefined && toAmountInCents(value) < minInCents) {
            return `Enter at least ${formatCurrency(minInCents / 100)}`;
          }
          if (maxInCents !== undefined && toAmountInCents(value) > maxInCents) {
            return `Enter at most ${formatCurrency(maxInCents / 100)}`;
          }
          return true;
        },
      }}
      render={({ field, fieldState: { error } }) => (
        <TextField
          label="Amount *"
          size="small"
          fullWidth
          disabled={disabled}
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            },
            htmlInput: {
              inputMode: 'decimal',
            },
          }}
          value={field.value}
          onChange={(e) => field.onChange(e.target.value)}
          error={!!error}
          helperText={error?.message}
        />
      )}
    />
  );
}
