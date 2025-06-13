import { FormControl, FormLabel, TextField } from '@mui/material';
import { Controller } from 'react-hook-form';
import { isNPIValid, RoleType } from 'utils';
import { dataTestIds } from '../../constants/data-test-ids';
import { ProviderDetailsProps } from './types';

export function ProviderDetails({ control, photoSrc, roles }: ProviderDetailsProps): JSX.Element {
  return (
    <FormControl sx={{ width: '100%' }}>
      <FormLabel sx={{ mt: 3, fontWeight: '600 !important' }}>Provider details</FormLabel>
      {photoSrc && <img src={photoSrc} width="110" height="110" style={{ borderRadius: '50%' }} />}
      <Controller
        name="nameSuffix"
        control={control}
        render={({ field: { onChange, value } }) => (
          <TextField
            label="Credentials"
            data-testid={dataTestIds.employeesPage.providerDetailsCredentials}
            value={value || ''}
            onChange={onChange}
            sx={{ marginTop: 3, width: '100%' }}
            margin="dense"
          />
        )}
      />
      <Controller
        name="npi"
        control={control}
        rules={{
          validate: (value) => {
            if (value) {
              return isNPIValid(value) ? true : 'NPI must be 10 digits';
            }
            return true;
          },
        }}
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <TextField
            label="NPI"
            data-testid={dataTestIds.employeesPage.providerDetailsNPI}
            required={roles.includes(RoleType.Provider)}
            value={value || ''}
            onChange={onChange}
            error={error?.message !== undefined}
            helperText={error?.message ?? ''}
            FormHelperTextProps={{
              sx: { ml: 0, mt: 1 },
            }}
            sx={{ marginTop: 2, marginBottom: 2, width: '100%' }}
            margin="dense"
          />
        )}
      />
    </FormControl>
  );
}
