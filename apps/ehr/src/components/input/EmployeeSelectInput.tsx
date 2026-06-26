import { useEffect, useState } from 'react';
import { getEmployees, listScheduleOwners } from 'src/api/api';
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
  // Also surface schedule-owning Practitioners that aren't EHR users (e.g. the default visit assignee).
  includeScheduleOwners?: boolean;
};

export const EmployeeSelectInput: React.FC<Props> = ({
  name,
  label,
  multiple,
  required,
  size,
  dataTestId,
  filter,
  includeScheduleOwners,
}) => {
  const { oystehrZambda } = useApiClients();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [options, setOptions] = useState<{ id: string; name: string }[] | undefined>(undefined);
  useEffect(() => {
    if (!oystehrZambda) {
      return;
    }
    async function loadOptions(): Promise<void> {
      if (!oystehrZambda) {
        return;
      }
      try {
        setIsLoading(true);
        const [getEmployeesResponse, scheduleOwnersResponse] = await Promise.all([
          getEmployees(oystehrZambda),
          includeScheduleOwners ? listScheduleOwners({ ownerType: 'Practitioner' }, oystehrZambda) : undefined,
        ]);
        if (getEmployeesResponse.employees || scheduleOwnersResponse) {
          // Employees added before schedule owners so their display name wins on id collision.
          const optionsById = new Map<string, { id: string; name: string }>();
          getEmployeesResponse.employees
            ?.filter((employee: any) => employee.status === 'Active' && (filter ? filter(employee) : true))
            .forEach((employee: any) => {
              const id = employee.profile.split('/')[1];
              optionsById.set(id, {
                id,
                name: `${employee.firstName} ${employee.lastName}`.trim() || employee.name,
              });
            });
          scheduleOwnersResponse?.list.forEach((item) => {
            if (!optionsById.has(item.owner.id)) {
              optionsById.set(item.owner.id, { id: item.owner.id, name: item.owner.name });
            }
          });
          const options = Array.from(optionsById.values());
          options.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
          setOptions(options);
        }
      } catch (e) {
        console.error('error loading providers', e);
      } finally {
        setIsLoading(false);
      }
    }
    void loadOptions();
  }, [filter, includeScheduleOwners, oystehrZambda]);
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
