import { Autocomplete, Box, TextField } from '@mui/material';
import { ReactElement } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { CMS_PLACE_OF_SERVICE_CODES, isCLIAValid, isNPIValidWithChecksum, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';

export function ServiceFacilityFields(): ReactElement {
  const { control } = useFormContext();
  return (
    <>
      <Controller
        name="name"
        control={control}
        rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
        render={({ field, fieldState: { error: fieldError } }) => (
          <TextField
            label="Name *"
            size="small"
            fullWidth
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            error={!!fieldError}
            helperText={fieldError?.message}
          />
        )}
      />
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Controller
          name="npi"
          control={control}
          rules={{
            validate: (value) =>
              !value ||
              isNPIValidWithChecksum(value) ||
              'NPI must be a valid 10-digit number with a correct check digit',
          }}
          render={({ field, fieldState: { error: fieldError } }) => (
            <TextField
              label="NPI"
              size="small"
              fullWidth
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              error={!!fieldError}
              helperText={fieldError?.message}
            />
          )}
        />
        <Controller
          name="clia"
          control={control}
          rules={{
            validate: (value) =>
              !value || isCLIAValid(value) || 'CLIA number must be 2 digits, a "D", then 7 digits (e.g. 05D1234567)',
          }}
          render={({ field, fieldState: { error: fieldError } }) => (
            <TextField
              label="CLIA Number"
              size="small"
              fullWidth
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              error={!!fieldError}
              helperText={fieldError?.message}
            />
          )}
        />
      </Box>
      <Controller
        name="placeOfService"
        control={control}
        render={({ field, fieldState: { error: fieldError } }) => (
          <Autocomplete
            size="small"
            options={CMS_PLACE_OF_SERVICE_CODES}
            getOptionLabel={(o) => `${o.code} - ${o.display}`}
            value={CMS_PLACE_OF_SERVICE_CODES.find((o) => o.code === field.value) ?? null}
            onChange={(_, v) => field.onChange(v?.code ?? '')}
            isOptionEqualToValue={(o, v) => o.code === v.code}
            renderInput={(params) => (
              <TextField {...params} label="Place of Service" error={!!fieldError} helperText={fieldError?.message} />
            )}
          />
        )}
      />
    </>
  );
}
