import { TextField, TextFieldProps } from '@mui/material';
import React, { FC } from 'react';
import { Controller, ControllerProps, useFormContext } from 'react-hook-form';

type TextFieldControllerProps = Pick<ControllerProps, 'name' | 'rules'> &
  Pick<
    TextFieldProps,
    'label' | 'placeholder' | 'InputProps' | 'children' | 'select' | 'multiline' | 'variant' | 'type'
  >;

export const TextFieldController: FC<TextFieldControllerProps> = (props) => {
  const { name, rules, label, placeholder, InputProps, children, select, multiline, variant, type } = props;

  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <TextField
          value={value}
          onChange={onChange}
          helperText={error ? error.message : null}
          error={!!error}
          size="small"
          fullWidth
          label={label}
          placeholder={placeholder}
          InputProps={InputProps}
          select={select}
          multiline={multiline}
          variant={variant}
          type={type}
        >
          {children}
        </TextField>
      )}
    />
  );
};
