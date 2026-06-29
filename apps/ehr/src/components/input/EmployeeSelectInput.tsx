import { toProviderDetails, useGetEmployeesWithDetails } from 'src/features/visits/shared/hooks/useGetEmployees';
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
    .map(toProviderDetails)
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <AutocompleteInput
      name={name}
      label={label}
      options={options}
      loading={isLoading}
      required={required}
      dataTestId={dataTestId}
      getOptionLabel={(option) =>
        option.name ??
        options?.find((opt) => opt.practitionerId === option.practitionerId)?.name ??
        option.practitionerId
      }
      getOptionKey={(option) => option.practitionerId}
      isOptionEqualToValue={(option, value) => option.practitionerId === value.practitionerId}
      multiple={multiple}
      size={size}
    />
  );
};
