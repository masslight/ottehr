import React from 'react';
import { AutocompleteInput } from './AutocompleteInput';
import { Option } from './Option';

type Props = {
  name: string;
  label: string;
  options: Option[] | undefined;
  loading?: boolean;
  required?: boolean;
  validate?: (value: string | undefined) => boolean | string;
};

export const SelectInput: React.FC<Props> = ({ name, label, options, loading, required, validate }) => {
  return (
    <AutocompleteInput
      name={name}
      label={label}
      options={options}
      loading={loading}
      required={required}
      selectOnly={true}
      validate={validate}
    />
  );
};
