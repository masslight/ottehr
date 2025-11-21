import { Autocomplete, AutocompleteProps, TextField } from '@mui/material';
import { ReactElement } from 'react';
import { Control, Controller, FieldValues, Path, UseControllerProps } from 'react-hook-form';

export interface Option {
  label: string;
  value: string;
}

interface FormAutocompleteProps<T extends FieldValues>
  extends Omit<AutocompleteProps<Option, false, true, false>, 'renderInput' | 'onChange' | 'value' | 'defaultValue'> {
  name: Path<T>;
  control: Control<T>;
  options: Option[];
  defaultValue?: string;
  rules?: UseControllerProps<T, Path<T>>['rules'];
  required?: boolean;
  onChangeHandler?: (name: string, value: string) => void;
  helperText?: string;
}

export const FormAutocomplete = <T extends FieldValues>({
  name,
  control,
  options,
  defaultValue = '',
  rules,
  required,
  onChangeHandler,
  helperText,
  ...autocompleteProps
}: FormAutocompleteProps<T>): ReactElement => (
  <Controller
    name={name}
    control={control}
    defaultValue={defaultValue as any}
    rules={{
      required,
      validate: (value) => !value || options.some((option) => option.value === value),
      ...rules,
    }}
    render={({ field: { onChange, value }, fieldState: { error } }) => (
      <Autocomplete<Option, false, true, false>
        {...autocompleteProps}
        options={options}
        value={options.find((option) => option.value === value) ?? undefined}
        onChange={(_, newValue) => {
          const newStringValue = newValue?.value || '';
          onChange(newStringValue as any);
          onChangeHandler?.(name, newStringValue);
        }}
        disableClearable={true}
        renderInput={(params) => (
          <TextField
            {...params}
            variant="standard"
            error={!!error}
            fullWidth
            helperText={error?.message || helperText}
          />
        )}
      />
    )}
  />
);
