import { SearchParam } from '@oystehr/sdk';
import { Patient } from 'fhir/r4b';
import { useState } from 'react';
import { getPatientLabel } from 'src/features/tasks/common';
import { useApiClients } from 'src/hooks/useAppClients';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { AutocompleteInput } from './AutocompleteInput';

type Props = {
  name: string;
  label: string;
  required?: boolean;
  dataTestId?: string;
};

export const PatientSelectInput: React.FC<Props> = ({ name, label, required, dataTestId }) => {
  const { oystehr } = useApiClients();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [options, setOptions] = useState<{ id: string; name: string }[]>([]);

  const { debounce } = useDebounce(800);
  const debouncedHandleInputChange = (data: string): void => {
    debounce(async () => {
      if (!oystehr) {
        return;
      }
      setOptions([]);
      setIsLoading(true);
      try {
        const [last, first] = data.split(',');
        const params: SearchParam[] = [{ name: '_count', value: 10 }];
        if (first) {
          params.push({ name: 'given:contains', value: first?.trim() });
        }
        if (last) {
          params.push({ name: 'family:contains', value: last?.trim() });
        }
        if (params.length > 1) {
          const patients = (
            await oystehr.fhir.search<Patient>({
              resourceType: 'Patient',
              params: params,
            })
          ).unbundle();
          setOptions(
            patients.map((patient) => {
              return {
                id: patient.id ?? '',
                name: getPatientLabel(patient),
              };
            })
          );
        } else {
          setOptions([]);
        }
      } finally {
        setIsLoading(false);
      }
    });
  };
  return (
    <AutocompleteInput
      name={name}
      label={label}
      options={options}
      loading={isLoading}
      required={required}
      dataTestId={dataTestId}
      onInputTextChanged={debouncedHandleInputChange}
      getOptionLabel={(option) => option.name}
      getOptionKey={(option) => option.id}
      isOptionEqualToValue={(option, value) => option.id === value.id}
    />
  );
};
