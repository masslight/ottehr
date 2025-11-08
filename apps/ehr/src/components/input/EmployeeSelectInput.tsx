import { useEffect, useState } from 'react';
import { getEmployees } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { EmployeeDetails } from 'utils';
import { AutocompleteInput } from './AutocompleteInput';
import { Option } from './Option';

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
  const [options, setOptions] = useState<Option[] | undefined>(undefined);
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
              value: employee.profile.split('/')[1],
              label: `${employee.firstName} ${employee.lastName}`.trim() || employee.name,
            }));
          options.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
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
    />
  );
};
