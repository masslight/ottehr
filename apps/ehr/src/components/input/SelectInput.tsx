import React from 'react';
import { AutocompleteInput } from './AutocompleteInput';

type Props = {
  name: string;
  label: string;
  options: any[] | undefined;
  loading?: boolean;
  required?: boolean;
  disabled?: boolean;
  validate?: (value: string | undefined) => boolean | string;
  dataTestId?: string;
  getOptionKey?: (option: any) => string;
  getOptionLabel?: (option: any) => string;
  isOptionEqualToValue?: (option: any, value: any) => boolean;
};

export const SelectInput: React.FC<Props> = ({
  name,
  label,
  options,
  loading,
  required,
  disabled,
  validate,
  dataTestId,
  getOptionKey,
  getOptionLabel,
  isOptionEqualToValue,
}) => {
  return (
    <AutocompleteInput
      name={name}
      label={label}
      options={options}
      loading={loading}
      required={required}
      disabled={disabled}
      selectOnly={true}
      validate={validate}
      dataTestId={dataTestId}
      getOptionKey={getOptionKey}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={isOptionEqualToValue}
    />
  );
};
