import React, { ReactElement } from 'react';
import { Controller, ControllerProps, useFormContext } from 'react-hook-form';
import { VirtualizedAutocomplete, VirtualizedAutocompleteProps } from './VirtualizedAutocomplete';

type VirtualizedAutocompleteControllerProps<T> = Pick<ControllerProps, 'name' | 'rules'> &
  Pick<VirtualizedAutocompleteProps<T>, 'options' | 'renderRow' | 'label'>;

export const VirtualizedAutocompleteController = <T,>(
  props: VirtualizedAutocompleteControllerProps<T>
): ReactElement => {
  const { name, rules, options, renderRow, label } = props;

  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <VirtualizedAutocomplete
          label={label}
          options={options}
          renderRow={renderRow}
          value={value}
          onChange={onChange}
          helperText={error ? error.message : null}
          error={!!error}
        />
      )}
    />
  );
};
