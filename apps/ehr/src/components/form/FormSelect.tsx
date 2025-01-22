import { Select, MenuItem, SelectProps } from '@mui/material';
import React, { ReactElement } from 'react';
import { Control, Controller, FieldValues, Path } from 'react-hook-form';

interface SelectOption {
  label: string;
  value: string;
}

interface FormSelectProps<T extends FieldValues> extends Omit<SelectProps, 'name'> {
  name: Path<T>;
  control: Control<T>;
  options: SelectOption[];
  defaultValue?: string;
  rules?: object;
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
}: FormSelectProps<T>): ReactElement => {
  return (
    <Controller
      name={name}
      control={control}
      defaultValue={defaultValue as any}
      rules={rules}
      render={({ field }) => (
        <Select
          {...field}
          {...selectProps}
          variant="standard"
          fullWidth
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
      )}
    />
  );
};
