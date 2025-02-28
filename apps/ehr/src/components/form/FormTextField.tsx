import { TextField, TextFieldProps } from '@mui/material';
import React, { ReactElement } from 'react';
import { Control, Controller, FieldValues, Path, RegisterOptions } from 'react-hook-form';

interface FormTextFieldProps<T extends FieldValues> extends Omit<TextFieldProps, 'name'> {
  name: Path<T>;
  control: Control<T>;
  defaultValue?: string;
  rules?: RegisterOptions;
  onChangeHandler?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  helperText?: string;
}

export const FormTextField = <T extends FieldValues>({
  name,
  control,
  defaultValue = '',
  rules,
  id,
  onChangeHandler,
  helperText,
  ...textFieldProps
}: FormTextFieldProps<T>): ReactElement => {
  const defaultErrorHelperText = rules?.required ? 'This field is required' : '';

  return (
    <Controller
      name={name}
      control={control}
      defaultValue={defaultValue as any}
      rules={rules}
      render={({ field, fieldState: { error } }) => (
        <TextField
          {...field}
          {...textFieldProps}
          id={id}
          error={!!error}
          variant="standard"
          fullWidth
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            field.onChange(e);
            onChangeHandler?.(e);
          }}
          helperText={error?.message || (error && defaultErrorHelperText) || helperText}
        />
      )}
    />
  );
};
