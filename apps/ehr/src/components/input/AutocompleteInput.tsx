import { Autocomplete, Box, FormHelperText, Skeleton, TextField } from '@mui/material';
import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';

export type AutocompleteInputProps<Value> = {
  name: string;
  label: string;
  options: Value[] | undefined;
  loading?: boolean;
  required?: boolean;
  disabled?: boolean;
  validate?: (value: string | undefined) => boolean | string;
  selectOnly?: boolean;
  freeSolo?: boolean;
  onInputTextChanged?: (text: string) => void;
  noOptionsText?: string;
  getOptionKey?: (option: Value) => string;
  getOptionLabel?: (option: Value) => string;
  isOptionEqualToValue?: (option: Value, value: Value) => boolean;
  dataTestId?: string;
};

export function AutocompleteInput<Value>({
  name,
  label,
  options,
  loading,
  required,
  disabled,
  validate,
  selectOnly,
  freeSolo,
  onInputTextChanged,
  noOptionsText,
  getOptionKey,
  getOptionLabel,
  isOptionEqualToValue,
  dataTestId,
}: AutocompleteInputProps<Value>): React.JSX.Element {
  const { control } = useFormContext();
  if (loading && !options) {
    return <Skeleton variant="rectangular" width="100%" height={40} />;
  }
  return (
    <Controller
      name={name}
      control={control}
      rules={{ required: required ? REQUIRED_FIELD_ERROR_MESSAGE : false, validate: validate }}
      render={({ field, fieldState: { error } }) => {
        let optionsToUse = [...(options ?? [])];

        // freeSolo updates field.value on each keystroke, and it doesn't need the typed value to be added to options
        if (
          !freeSolo &&
          field.value &&
          !options?.find((option) =>
            isOptionEqualToValue ? isOptionEqualToValue(option, field.value) : option === field.value
          )
        ) {
          optionsToUse = [...optionsToUse, field.value];
        }
        return (
          <Box sx={{ width: '100%' }}>
            <Autocomplete<Value, false, false, boolean>
              value={field.value ?? null}
              options={optionsToUse}
              // MUI types getOptionKey/getOptionLabel as (option: Value | string) => ... when FreeSolo
              // is boolean rather than false, but our props already enforce the correct type for callers.
              // The as any casts are safe here
              getOptionKey={getOptionKey as any}
              noOptionsText={noOptionsText}
              getOptionLabel={getOptionLabel as any}
              isOptionEqualToValue={isOptionEqualToValue as any}
              freeSolo={freeSolo}
              onChange={(_e, option: any) => field.onChange(option ?? null)}
              {...(freeSolo
                ? {
                    onInputChange: (_e: any, newValue: string, reason: string) => {
                      if (reason === 'input') {
                        field.onChange(newValue || null);
                      }
                    },
                  }
                : {})}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={label + (required ? '*' : '')}
                  placeholder={label}
                  inputProps={{ ...params.inputProps, readOnly: selectOnly }}
                  error={error != null}
                  size="small"
                  onChange={onInputTextChanged ? (e) => onInputTextChanged(e.target.value) : undefined}
                  data-testid={dataTestId}
                />
              )}
              loading={loading}
              disabled={disabled}
              fullWidth
            />
            {error && <FormHelperText error={true}>{error?.message}</FormHelperText>}
          </Box>
        );
      }}
    />
  );
}
