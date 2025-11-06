import { SearchParam } from '@oystehr/sdk';
import { Patient } from 'fhir/r4b';
import { useState } from 'react';
import { getPatientLabel } from 'src/features/tasks/common';
import { useApiClients } from 'src/hooks/useAppClients';
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
  const { oystehr } = useApiClients();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [options, setOptions] = useState<Option[]>([]);

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
                label: getPatientLabel(patient),
                value: patient.id ?? '',
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
