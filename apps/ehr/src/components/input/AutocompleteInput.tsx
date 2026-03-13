import { Autocomplete, Box, FormHelperText, Skeleton, TextField } from '@mui/material';
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
        const optionsToUse = options ?? [];
        if (
          field.value &&
          !options?.find((option) =>
            isOptionEqualToValue ? isOptionEqualToValue(option, field.value) : option === field.value
          )
        ) {
          optionsToUse?.push(field.value);
        }
        return (
          <Box sx={{ width: '100%' }}>
            <Autocomplete
              value={field.value ?? null}
              options={optionsToUse}
              getOptionKey={getOptionKey}
              noOptionsText={noOptionsText}
              getOptionLabel={getOptionLabel}
              isOptionEqualToValue={isOptionEqualToValue}
              onChange={(_e, option: any) => field.onChange(option ?? null)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={label + (required ? '*' : '')}
                  placeholder={`Select ${label}`}
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
