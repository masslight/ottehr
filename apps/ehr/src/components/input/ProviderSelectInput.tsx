import { useEffect, useState } from 'react';
import { getEmployees } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { AutocompleteInput } from './AutocompleteInput';
import { Option } from './Option';

type Props = {
  name: string;
  label: string;
  required?: boolean;
};

export const ProviderSelectInput: React.FC<Props> = ({ name, label, required }) => {
  const { oystehrZambda } = useApiClients();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [options, setOptions] = useState<Option[] | undefined>(undefined);
  useEffect(() => {
    if (!oystehrZambda) {
      return;
    }
    async function loadProvidersOptions(): Promise<void> {
      if (!oystehrZambda) {
        return;
      }
      try {
        setIsLoading(true);
        const getEmployeesResponse = await getEmployees(oystehrZambda);
        if (getEmployeesResponse.employees) {
          const providerOptions = getEmployeesResponse.employees
            .filter((employee: any) => employee.status === 'Active' && employee.isProvider)
            .map((employee: any) => ({
              value: employee.profile.split('/')[1],
              label: `${employee.firstName} ${employee.lastName}`.trim() || employee.name,
            }));
          providerOptions.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
          setOptions(providerOptions);
        }
      } catch (e) {
        console.error('error loading providers', e);
      } finally {
        setIsLoading(false);
      }
    }
    void loadProvidersOptions();
  }, [oystehrZambda]);
  return <AutocompleteInput name={name} label={label} options={options} loading={isLoading} required={required} />;
};
