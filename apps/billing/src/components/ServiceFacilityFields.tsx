import { Autocomplete, Box, TextField } from '@mui/material';
import { ReactElement } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { isCLIAValid, isNPIValidWithChecksum } from 'utils/lib/helpers/helpers';
import { CMS_PLACE_OF_SERVICE_CODES } from 'utils/lib/helpers/rcm/constants';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';
import { DuplicateServiceFacilityWarning } from './DuplicateServiceFacilityWarning';

// Pass `duplicateCheck` to warn when the entered NPI/CLIA is already used by another master facility
// (`facilityId` is the facility being edited, excluded from the matches). Claim working copies
// share their source's identifiers by design, so claim screens omit it.
export function ServiceFacilityFields({
  duplicateCheck,
}: {
  duplicateCheck?: { facilityId?: string };
} = {}): ReactElement {
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
      {duplicateCheck && <DuplicateServiceFacilityWarning facilityId={duplicateCheck.facilityId} />}
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
