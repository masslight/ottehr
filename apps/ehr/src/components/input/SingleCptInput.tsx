import { useState } from 'react';
import { useDebounce, useGetIcd10Search } from 'src/telemed';
import { CPTCodeDTO } from 'utils';
import { AutocompleteInput } from './AutocompleteInput';

type Props = {
  name: string;
  label: string;
  required?: boolean;
};

export const SingleCptCodeInput: React.FC<Props> = ({ name, label, required }) => {
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const { isFetching, data } = useGetIcd10Search({ search: debouncedSearchTerm, sabs: 'CPT' });
  const options = ((data as { codes?: CPTCodeDTO[] })?.codes || []).map((cptCodeDto) => {
    return {
      label: `${cptCodeDto.code} ${cptCodeDto.display}`,
      value: cptCodeDto.code,
    };
  });
  const { debounce } = useDebounce(800);
  const debouncedHandleInputChange = (data: string): void => {
    debounce(() => {
      setDebouncedSearchTerm(data);
    });
  };
  return (
    <AutocompleteInput
      name={name}
      label={label}
      options={options}
      loading={isFetching}
      required={required}
      onInputTextChanged={debouncedHandleInputChange}
      noOptionsText={debouncedSearchTerm.length === 0 ? 'Start typing to load results' : undefined}
    />
  );
};
