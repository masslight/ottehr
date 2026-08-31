import { otherColors } from '@ehrTheme/colors';
import { Chip, FormControl, Grid, Stack, TextField, Typography, useTheme } from '@mui/material';
import { Controller } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { isNPIValidWithChecksum } from 'utils/lib/helpers/helpers';
import { RoleType } from 'utils/lib/types/api/user.types';
import { ProviderTypeField } from './ProviderType';
import { ProviderDetailsProps } from './types';

export function ProviderDetails({
  control,
  setValue,
  photoSrc,
  roles,
  seenPatientRecently,
}: ProviderDetailsProps): JSX.Element {
  const theme = useTheme();

  return (
    <FormControl sx={{ width: '100%' }}>
      <Stack direction="row" alignItems="center" gap={2} sx={{ mb: 2 }}>
        <Typography sx={{ ...theme.typography.h4, color: theme.palette.primary.dark }}>Provider details</Typography>
        {seenPatientRecently && (
          <Chip
            label="BEEN SEEN LAST 30 MINS"
            size="small"
            data-testid={dataTestIds.employeesPage.seenPatientRecentlyChip}
            sx={{
              backgroundColor: otherColors.employeeBeenSeenChip,
              color: otherColors.employeeBeenSeenText,
              borderRadius: '4px',
            }}
          />
        )}
      </Stack>
      {photoSrc && <img src={photoSrc} width="110" height="110" style={{ borderRadius: '50%' }} />}

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <ProviderTypeField control={control} setValue={setValue} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Controller
            name="npi"
            control={control}
            rules={{
              validate: (value) => {
                if (value) {
                  return isNPIValidWithChecksum(value)
                    ? true
                    : 'NPI must be a valid 10-digit number with a correct check digit';
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
                sx={{ width: '100%' }}
                margin="dense"
              />
            )}
          />
        </Grid>
      </Grid>
    </FormControl>
  );
}
