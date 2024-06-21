import React, { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Checkbox, FormControlLabel } from '@mui/material';
import { SchoolExcuseFields, WorkExcuseFields } from '../../../../utils';

type ControlledExcuseCheckboxProps = {
  label: string;
  name: WorkExcuseFields | SchoolExcuseFields;
  onChange?: (newValue: boolean) => void;
};

export const ControlledExcuseCheckbox: FC<ControlledExcuseCheckboxProps> = (props) => {
  const { label, name, onChange: onExternalChange } = props;

  const { control } = useFormContext();

  return (
    <FormControlLabel
      control={
        <Controller
          name={name}
          control={control}
          render={({ field: { value, onChange } }) => (
            <Checkbox
              checked={value}
              onChange={(e) => {
                onExternalChange && onExternalChange(e.target.checked);
                onChange(e);
              }}
            />
          )}
        />
      }
      label={label}
    />
  );
};
