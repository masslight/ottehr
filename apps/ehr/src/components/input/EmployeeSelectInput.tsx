import { useEffect, useState } from 'react';
import { getEmployees } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { EmployeeDetails } from 'utils';
import { AutocompleteInput } from './AutocompleteInput';

export const PROVIDERS_FILTER = (employee: EmployeeDetails): boolean => {
  return employee.isProvider;
};

type Props = {
  name: string;
  label: string;
  required?: boolean;
  dataTestId?: string;
  filter?: (employee: EmployeeDetails) => boolean;
};

export const EmployeeSelectInput: React.FC<Props> = ({ name, label, required, dataTestId, filter }) => {
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
        const getEmployeesResponse = await getEmployees(oystehrZambda);
        if (getEmployeesResponse.employees) {
          const options = getEmployeesResponse.employees
            .filter((employee: any) => employee.status === 'Active' && (filter ? filter(employee) : true))
            .map((employee: any) => ({
              id: employee.profile.split('/')[1],
              name: `${employee.firstName} ${employee.lastName}`.trim() || employee.name,
            }));
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
  }, [filter, oystehrZambda]);
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
    />
  );
};
