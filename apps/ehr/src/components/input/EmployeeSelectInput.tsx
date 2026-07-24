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
  // Source from the broader assignable-staff pool (currently named
  // `nonProviders` — a misnomer; it's "all non-customer-support employees"
  // and includes providers). Callers that want only providers narrow via
  // the `filter` prop (PROVIDERS_FILTER). Sourcing from `employees.providers`
  // here would make the filter unable to broaden, so no-filter callers like
  // task assignment dialogs lose the ability to assign to non-provider
  // staff (intake, nurses).
  // While loading, pass `undefined` (not `[]`) so AutocompleteInput's skeleton
  // guard fires instead of rendering the field with the value's stale stored label.
  const options = isLoading
    ? undefined
    : (employees?.nonProviders ?? [])
        .filter(filter ?? (() => true))
        .map((item) => {
          const pdeets = toProviderDetails(item);
          return {
            id: pdeets.practitionerId,
            name: pdeets.name,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <AutocompleteInput
      name={name}
      label={label}
      options={options}
      loading={isLoading}
      required={required}
      dataTestId={dataTestId}
      getOptionLabel={(option) => options?.find((opt) => opt.id === option.id)?.name ?? option.name ?? option.id}
      getOptionKey={(option) => option.id}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      multiple={multiple}
      size={size}
    />
  );
};
