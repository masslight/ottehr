import { usePatientsSearch } from 'src/features/visits/shared/components/patients-search/usePatientsSearch';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { AutocompleteInput } from './AutocompleteInput';
import { Option } from './Option';

type Props = {
  name: string;
  label: string;
  required?: boolean;
  dataTestId?: string;
};

export const PatientSelectInput: React.FC<Props> = ({ name, label, required, dataTestId }) => {
  const { searchResult, arePatientsLoading, search } = usePatientsSearch();

  const options = searchResult.patients.map((patient) => {
    return {
      label: patient.name,
      value: patient.id,
    };
  });
  const { debounce } = useDebounce(800);
  const debouncedHandleInputChange = (data: string): void => {
    debounce(() => {
      const [last, first] = data.split(',');
      search({
        filters: {
          givenNames: first?.trim(),
          lastName: last?.trim(),
        },
        pagination: {
          pageSize: 10,
          offset: 0,
        },
      });
    });
  };
  return (
    <AutocompleteInput
      name={name}
      label={label}
      options={options}
      loading={arePatientsLoading}
      required={required}
      dataTestId={dataTestId}
      valueToOption={(value: any) => {
        return {
          label: value.name,
          value: value.id,
        };
      }}
      optionToValue={(option: Option) => {
        return {
          name: option.label,
          id: option.value,
        };
      }}
      onInputTextChanged={debouncedHandleInputChange}
    />
  );
};
