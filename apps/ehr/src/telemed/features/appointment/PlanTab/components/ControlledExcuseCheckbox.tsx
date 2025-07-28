import { Checkbox, FormControlLabel } from '@mui/material';
import React, { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { SchoolExcuseFields, WorkExcuseFields } from '../../../../utils';

type ControlledExcuseCheckboxProps = {
  label: string;
  name: SchoolExcuseFields | WorkExcuseFields;
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
                if (onExternalChange) {
                  onExternalChange(e.target.checked);
                }
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
