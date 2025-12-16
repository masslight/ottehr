import { useState } from 'react';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { CPTCodeDTO } from 'utils';
import { useGetCPTSearch } from '../../features/visits/shared/stores/appointment/appointment.queries';
import { AutocompleteInput } from './AutocompleteInput';

type Props = {
  name: string;
  label: string;
  required?: boolean;
  dataTestId?: string;
};

export const SingleCptCodeInput: React.FC<Props> = ({ name, label, required, dataTestId }) => {
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const { isFetching, data } = useGetCPTSearch({ search: debouncedSearchTerm });
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
      dataTestId={dataTestId}
    />
  );
};
