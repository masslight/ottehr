import {
  Autocomplete,
  Box,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import {
  isNPIValidWithChecksum,
  PractitionerQualificationCodesDisplay,
  REQUIRED_FIELD_ERROR_MESSAGE,
  stripeAccountIdRegex,
  taxIdRegex,
} from 'utils';
import { ProviderForm } from '../constants/provider';

export function ProviderFields(): ReactElement {
  const { control, watch } = useFormContext<ProviderForm>();
  const selectedKind = watch('kind');
  return (
    <>
      <Controller
        name="kind"
        control={control}
        rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
        render={({ field, fieldState: { error: fieldError } }) => (
          <FormControl size="small" fullWidth>
            <InputLabel id="kind-select-label" error={!!fieldError}>
              Provider Type *
            </InputLabel>
            <Select
              aria-describedby={fieldError ? 'kind-helper-text' : undefined}
              label="Provider Type *"
              labelId="kind-select-label"
              size="small"
              fullWidth
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              error={!!fieldError}
            >
              <MenuItem value="individual">Individual</MenuItem>
              <MenuItem value="organization">Organization</MenuItem>
            </Select>
            {fieldError ? (
              <FormHelperText id={`kind-helper-text`} error={true}>
                {fieldError?.message}
              </FormHelperText>
            ) : (
              <></>
            )}
          </FormControl>
        )}
      />

      {selectedKind === 'individual' ? (
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Controller
            name="firstName"
            control={control}
            rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
            render={({ field, fieldState: { error: fieldError } }) => (
              <TextField
                label="First name *"
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
            name="lastName"
            control={control}
            rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
            render={({ field, fieldState: { error: fieldError } }) => (
              <TextField
                label="Last name *"
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
      ) : (
        <Controller
          name="orgName"
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          render={({ field, fieldState: { error: fieldError } }) => (
            <TextField
              label="Organization name *"
              size="small"
              fullWidth
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              error={!!fieldError}
              helperText={fieldError?.message}
            />
          )}
        />
      )}

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Controller
          name="npi"
          control={control}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
            validate: (value) =>
              (value && isNPIValidWithChecksum(value)) ||
              'NPI must be a valid 10-digit number with a correct check digit',
          }}
          render={({ field, fieldState: { error: fieldError } }) => (
            <TextField
              label="NPI *"
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
          name="taxId"
          control={control}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
            validate: (value) => (value && taxIdRegex.test(value)) || 'Tax ID / EIN must be exactly 9 digits',
          }}
          render={({ field, fieldState: { error: fieldError } }) => (
            <TextField
              label="Tax ID *"
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

      {selectedKind === 'organization' && (
        <Controller
          name="stripeAccountId"
          control={control}
          rules={{
            validate: (value) =>
              !value?.trim() || stripeAccountIdRegex.test(value.trim()) || 'Stripe account ID must start with acct_',
          }}
          render={({ field, fieldState: { error: fieldError } }) => (
            <TextField
              label="Stripe Account ID"
              size="small"
              fullWidth
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              error={!!fieldError}
              helperText={fieldError?.message}
            />
          )}
        />
      )}

      {selectedKind === 'individual' && (
        <Controller
          name="licenseType"
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          render={({ field, fieldState: { error: fieldError } }) => (
            <Autocomplete
              size="small"
              options={PractitionerQualificationCodesDisplay}
              getOptionLabel={(o) => o.label}
              value={PractitionerQualificationCodesDisplay.find((o) => o.value === field.value) ?? null}
              onChange={(_, v) => field.onChange(v?.value ?? '')}
              isOptionEqualToValue={(o, v) => o.value === v.value}
              renderInput={(params) => (
                <TextField {...params} label="License Type *" error={!!fieldError} helperText={fieldError?.message} />
              )}
            />
          )}
        />
      )}
      <Controller
        name="taxonomyCode"
        control={control}
        rules={{
          required: REQUIRED_FIELD_ERROR_MESSAGE,
          validate: (value) => (value && value.length === 10) || 'Taxonomy code must be exactly 10 characters',
        }}
        render={({ field, fieldState: { error: fieldError } }) => (
          <Box>
            <TextField
              label="Taxonomy Code *"
              size="small"
              fullWidth
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              error={!!fieldError}
              helperText={fieldError?.message}
            />
            <Typography variant="caption">
              Look up taxonomy codes{' '}
              <Link target="_blank" href="https://npiregistry.cms.hhs.gov/search">
                here
              </Link>
              .
            </Typography>
          </Box>
        )}
      />

      <Box sx={{ display: 'flex', gap: 4 }}>
        <Controller
          name="renders"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={<Switch checked={field.value} onChange={(_event, checked) => field.onChange(checked)} />}
              label="Renders medical services"
            />
          )}
        />
        <Controller
          name="bills"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={<Switch checked={field.value} onChange={(_event, checked) => field.onChange(checked)} />}
              label="Bills medical services"
            />
          )}
        />
      </Box>
    </>
  );
}
