import React from 'react';
import { AutocompleteInput } from './AutocompleteInput';
import { Option } from './Option';

type Props = {
  name: string;
  label: string;
  options: Option[] | undefined;
  loading?: boolean;
  required?: boolean;
};

export const SelectInput: React.FC<Props> = ({ name, label, options, loading, required }) => {
  return (
    <AutocompleteInput
      name={name}
      label={label}
      options={options}
      loading={loading}
      required={required}
      selectOnly={true}
    />
  );
};
