import { Add as AddIcon, DeleteOutline as DeleteIcon } from '@mui/icons-material';
import {
  Autocomplete,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement } from 'react';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { InputMask } from 'ui-components/lib/components/InputMask';
import { isNPIValidWithChecksum } from 'utils/lib/helpers/helpers';
import { PractitionerQualificationCodesDisplay } from 'utils/lib/types/api/practitioner.types';
import { AllStates, stateCodeToFullName } from 'utils/lib/types/common';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';
import { stripeAccountIdRegex, taxIdRegex } from 'utils/lib/validation/regex';
import { emptyProviderLicense, ProviderForm } from '../constants/provider';
import { AddressFields } from './AddressFields';

// Tax ID and address are only required for providers that bill.
export function ProviderAddressFields(): ReactElement {
  const { watch } = useFormContext<ProviderForm>();
  return <AddressFields required={watch('bills')} />;
}

export function ProviderFields(): ReactElement {
  const { control, watch } = useFormContext<ProviderForm>();
  const selectedKind = watch('kind');
  const bills = watch('bills');
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
            required: bills ? REQUIRED_FIELD_ERROR_MESSAGE : false,
            validate: (value) => !value || taxIdRegex.test(value) || 'Tax ID / EIN must be exactly 9 digits',
          }}
          render={({ field, fieldState: { error: fieldError } }) => (
            <TextField
              label={bills ? 'Tax ID *' : 'Tax ID'}
              size="small"
              fullWidth
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              error={!!fieldError}
              helperText={fieldError?.message}
              inputProps={{ mask: '00-0000000', unmask: true }}
              InputProps={{
                inputComponent: InputMask as any,
              }}
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

      {selectedKind === 'individual' && <ProviderLicenseFields />}
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

// An individual provider can hold several licenses (e.g. one per state); at least one is required.
function ProviderLicenseFields(): ReactElement {
  const { control, getValues } = useFormContext<ProviderForm>();
  const { fields, append, remove } = useFieldArray({ control, name: 'licenses' });

  const isDuplicate = (index: number): boolean => {
    const licenses = getValues('licenses');
    const { type, state } = licenses[index];
    return licenses.some((other, i) => i !== index && other.type === type && other.state === state);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2" color="primary.dark" fontWeight={600}>
          Licenses
        </Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => append(emptyProviderLicense())}>
          Add License
        </Button>
      </Box>
      {fields.map((license, index) => (
        <Box key={license.id} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <Controller
            name={`licenses.${index}.type`}
            control={control}
            rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
            render={({ field, fieldState: { error: fieldError } }) => (
              <Autocomplete
                size="small"
                sx={{ flex: 2, minWidth: 0 }}
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
          <Controller
            name={`licenses.${index}.number`}
            control={control}
            rules={{ validate: (value) => !!value?.trim() || REQUIRED_FIELD_ERROR_MESSAGE }}
            render={({ field, fieldState: { error: fieldError } }) => (
              <TextField
                label="License Number *"
                size="small"
                sx={{ flex: 1, minWidth: 0 }}
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                error={!!fieldError}
                helperText={fieldError?.message}
              />
            )}
          />
          <Controller
            name={`licenses.${index}.state`}
            control={control}
            rules={{
              required: REQUIRED_FIELD_ERROR_MESSAGE,
              validate: () => !isDuplicate(index) || 'Duplicate license type for this state',
            }}
            render={({ field, fieldState: { error: fieldError } }) => (
              <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
                <InputLabel id={`license-state-label-${index}`} error={!!fieldError}>
                  License State *
                </InputLabel>
                <Select
                  aria-describedby={fieldError ? `license-state-helper-text-${index}` : undefined}
                  label="License State *"
                  labelId={`license-state-label-${index}`}
                  size="small"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  error={!!fieldError}
                >
                  {AllStates.map((state) => (
                    <MenuItem value={state.value} key={state.value}>
                      {stateCodeToFullName[state.value]}
                    </MenuItem>
                  ))}
                </Select>
                {fieldError ? (
                  <FormHelperText id={`license-state-helper-text-${index}`} error={true}>
                    {fieldError.message}
                  </FormHelperText>
                ) : (
                  <></>
                )}
              </FormControl>
            )}
          />
          <IconButton
            size="small"
            sx={{ mt: 0.5 }}
            aria-label={`Remove license ${index + 1}`}
            disabled={fields.length === 1}
            onClick={() => remove(index)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
    </Box>
  );
}
