import { Autocomplete, Box, FormHelperText, Skeleton, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { getEmployees } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import { Option } from './Option';

type Props = {
  name: string;
  label: string;
  required?: boolean;
};

export const ProviderSelectInput: React.FC<Props> = ({ name, label, required }) => {
  const { oystehrZambda } = useApiClients();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [options, setOptions] = useState<Option[]>([]);
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
  const { formState, control } = useFormContext();
  return !isLoading ? (
    <Controller
      name={name}
      control={control}
      rules={{ required: required ? REQUIRED_FIELD_ERROR_MESSAGE : false }}
      render={({ field, fieldState: { error } }) => (
        <Box sx={{ width: '100%' }}>
          <Autocomplete
            options={options}
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(option, value) => option.value === value.value}
            onChange={(_e, option: any) => field.onChange(option)}
            renderInput={(params) => (
              <TextField
                {...params}
                label={label + (required ? '*' : '')}
                placeholder={`Select ${label}`}
                inputProps={{ ...params.inputProps }}
                error={formState.errors[name] != null}
              />
            )}
            fullWidth
          />
          {error && <FormHelperText error={true}>{error?.message}</FormHelperText>}
        </Box>
      )}
    />
  ) : (
    <Skeleton variant="rectangular" width="100%" height={56} />
  );
};
