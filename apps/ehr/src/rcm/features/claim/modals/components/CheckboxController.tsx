import { Checkbox, FormControlLabel } from '@mui/material';
import React, { FC } from 'react';
import { Controller, ControllerProps, useFormContext } from 'react-hook-form';

type CheckboxControllerProps = Pick<ControllerProps, 'name' | 'rules'> & { label?: string };

export const CheckboxController: FC<CheckboxControllerProps> = (props) => {
  const { name, rules, label } = props;

  const { control } = useFormContext();

  const controller = (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field }) => <Checkbox {...field} checked={field.value} onChange={field.onChange} />}
    />
  );

  if (label) {
    return <FormControlLabel control={controller} label={label} />;
  } else {
    return controller;
  }
};
