import React, { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { TextField } from '@mui/material';
import { NoteExcuseFields } from '../../../../utils';

type ControlledExcuseTextFieldProps = {
  name: NoteExcuseFields;
  validate?: (value: string) => string | undefined;
  placeholder?: string;
  label?: string;
  fullWidth?: boolean;
  multiline?: boolean;
  required?: boolean;
};

export const ControlledExcuseTextField: FC<ControlledExcuseTextFieldProps> = (props) => {
  const { name, validate, placeholder, label, fullWidth, multiline, required } = props;

  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      rules={{ validate, required }}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <TextField
          error={!!error}
          helperText={error?.message}
          placeholder={placeholder}
          label={label}
          size="small"
          value={value}
          onChange={onChange}
          fullWidth={fullWidth}
          multiline={multiline}
        />
      )}
    />
  );
};
