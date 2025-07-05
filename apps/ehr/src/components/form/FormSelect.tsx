import { FormHelperText, MenuItem, Select, SelectProps } from '@mui/material';
import { Box } from '@mui/system';
import React, { ReactElement } from 'react';
import { Control, Controller, FieldValues, Path, RegisterOptions } from 'react-hook-form';

interface SelectOption {
  label: string;
  value: string | number;
}

interface FormSelectProps<T extends FieldValues> extends Omit<SelectProps, 'name'> {
  name: Path<T>;
  control: Control<T>;
  options: SelectOption[];
  defaultValue?: string;
  rules?: RegisterOptions;
  onChangeHandler?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const FormSelect = <T extends FieldValues>({
  name,
  control,
  options,
  defaultValue = '',
  rules,
  onChangeHandler,
  ...selectProps
}: FormSelectProps<T>): ReactElement => (
  <Controller
    name={name}
    control={control}
    defaultValue={defaultValue as any}
    rules={rules}
    render={({ field, fieldState: { error } }) => (
      <Box sx={{ width: '100%' }}>
        <Select
          {...field}
          {...selectProps}
          variant={selectProps.variant ?? 'standard'}
          fullWidth
          error={!!error}
          onChange={(e) => {
            field.onChange(e as any);
            onChangeHandler?.(e as any);
          }}
        >
          {options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
        {error && <FormHelperText error={true}>{error?.message}</FormHelperText>}
      </Box>
    )}
  />
);
