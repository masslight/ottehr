import { useGetEmployeesWithDetails } from 'src/features/visits/shared/hooks/useGetEmployees';
import { useApiClients } from 'src/hooks/useAppClients';
import { EmployeeDetails } from 'utils';
import { AutocompleteInput } from './AutocompleteInput';

type Props = {
  name: string;
  label: string;
  multiple?: boolean;
  required?: boolean;
  size?: 'small' | 'medium';
  dataTestId?: string;
  filter?: (employee: EmployeeDetails) => boolean;
};

export const EmployeeSelectInput: React.FC<Props> = ({ name, label, multiple, required, size, dataTestId, filter }) => {
  const { oystehrZambda } = useApiClients();
  const { data: employees, isLoading } = useGetEmployeesWithDetails({ enabled: !!oystehrZambda });
  const options = (employees?.providers ?? [])
    .filter(filter ?? (() => true))
    .map((prov) => ({ id: prov.id, name: prov.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  console.log('EmployeeSelectInput options:', options, 'employees:', employees);
  return (
    <AutocompleteInput
      name={name}
      label={label}
      options={options}
      loading={isLoading}
      required={required}
      dataTestId={dataTestId}
      getOptionLabel={(option) => option.name ?? options?.find((opt) => opt.id === option.id)?.name ?? option.id}
      getOptionKey={(option) => option.id}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      multiple={multiple}
      size={size}
    />
  );
};
