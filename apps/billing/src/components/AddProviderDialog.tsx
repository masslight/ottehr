import { Close as CloseIcon, Save as SaveIcon } from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { ReactElement, useEffect, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import {
  CreateBillingProviderInput,
  getApiError,
  isNPIValidWithChecksum,
  PractitionerQualificationCodesDisplay,
  REQUIRED_FIELD_ERROR_MESSAGE,
  taxIdRegex,
} from 'utils';
import { createBillingProvider } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { buildAddressInput } from '../utils/format';
import { AddressFields } from './AddressFields';

type ProviderKind = 'individual' | 'organization';

interface AddProviderDialogProps {
  open: boolean;
  defaultRole: 'billing' | 'rendering';
  onClose: () => void;
  onCreated: () => void;
}

interface AddProviderForm {
  kind: ProviderKind;
  firstName: string | null;
  lastName: string | null;
  orgName: string | null;
  npi: string | null;
  licenseType: string | null;
  taxonomyCode: string | null;
  taxId: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  renders: boolean;
  bills: boolean;
}

const defaultValues: AddProviderForm = {
  kind: 'individual',
  firstName: null,
  lastName: null,
  orgName: null,
  npi: null,
  licenseType: null,
  taxonomyCode: null,
  taxId: null,
  line1: null,
  line2: null,
  city: null,
  state: null,
  zip: null,
  renders: false,
  bills: false,
};

export function AddProviderDialog({ open, defaultRole, onClose, onCreated }: AddProviderDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const methods = useForm<AddProviderForm>({
    defaultValues: {
      ...defaultValues,
      kind: defaultRole === 'rendering' ? 'individual' : 'organization',
      renders: defaultRole === 'rendering',
      bills: defaultRole === 'billing',
    },
  });
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting },
  } = methods;

  const selectedKind = watch('kind');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    reset();
  }, [open, reset]);

  const handleSave = async (data: AddProviderForm): Promise<void> => {
    if (!oystehrZambda) return;
    if (!data.renders && !data.bills) {
      return setError('Provider must render or bill');
    }
    setError(null);
    try {
      const roles = [...(data.bills ? ['billing'] : []), ...(data.renders ? ['rendering'] : [])];
      const address = buildAddressInput(data.line1, data.line2, data.city, data.state, data.zip);
      const common = {
        roles,
        ...(data.npi?.trim() ? { npi: data.npi.trim() } : {}),
        ...(data.taxonomyCode?.trim() ? { taxonomyCode: data.taxonomyCode.trim() } : {}),
        ...(data.taxId?.trim() ? { taxId: data.taxId.trim() } : {}),
        ...(address ? { address } : {}),
      };
      const payload =
        data.kind === 'individual'
          ? {
              kind: data.kind,
              firstName: data.firstName?.trim(),
              lastName: data.lastName?.trim(),
              ...(data.licenseType ? { licenseType: data.licenseType } : {}),
              ...common,
            }
          : { kind: data.kind, name: data.orgName?.trim(), ...common };

      const result = await createBillingProvider(oystehrZambda, payload as CreateBillingProviderInput);
      if (!result.id) throw new Error('Provider was not created');
      onCreated();
      onClose();
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to create provider' }));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 980, maxWidth: '95vw' } }}>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5">Add Provider</Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <FormProvider {...methods}>
          <Box sx={{ display: 'flex', gap: 5, mt: 1 }}>
            {/* Left: provider */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
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
                        <TextField
                          {...params}
                          label="License Type *"
                          error={!!fieldError}
                          helperText={fieldError?.message}
                        />
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
            </Box>

            {/* Right: address */}
            <AddressFields />
          </Box>
        </FormProvider>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          startIcon={isSubmitting ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
          onClick={handleSubmit(handleSave)}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
