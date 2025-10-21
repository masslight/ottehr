import { FormControl, TextField, Typography, useTheme } from '@mui/material';
import { Controller } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { isNPIValid, RoleType } from 'utils';
import { ProviderTypeField } from './ProviderType';
import { ProviderDetailsProps } from './types';

export function ProviderDetails({ control, setValue, photoSrc, roles }: ProviderDetailsProps): JSX.Element {
  const theme = useTheme();

  return (
    <FormControl sx={{ width: '100%' }}>
      <Typography sx={{ ...theme.typography.h4, color: theme.palette.primary.dark, mb: 2 }}>
        Provider details
      </Typography>
      {photoSrc && <img src={photoSrc} width="110" height="110" style={{ borderRadius: '50%' }} />}
      <ProviderTypeField control={control} setValue={setValue} />

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
