import { Close as CloseIcon } from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import {
  CMS_PLACE_OF_SERVICE_CODES,
  getApiError,
  isCLIAValid,
  isNPIValidWithChecksum,
  REQUIRED_FIELD_ERROR_MESSAGE,
  SaveServiceFacilityInput,
} from 'utils';
import { saveBillingServiceFacility } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { AddressFields } from './AddressFields';

interface AddServiceFacilityDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface AddServiceFacilityForm {
  name: string | null;
  npi: string | null;
  clia: string | null;
  placeOfService: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

const defaultValues: AddServiceFacilityForm = {
  name: null,
  npi: null,
  clia: null,
  placeOfService: null,
  line1: null,
  line2: null,
  city: null,
  state: null,
  zip: null,
};

export function AddServiceFacilityDialog({ open, onClose, onCreated }: AddServiceFacilityDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const methods = useForm<AddServiceFacilityForm>({ defaultValues });
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    reset();
  }, [open, reset]);

  const handleSave = async (data: AddServiceFacilityForm): Promise<void> => {
    if (!oystehrZambda) return;
    setError(null);
    try {
      const payload: SaveServiceFacilityInput = {
        name: data.name!.trim(),
        addressLine1: data.line1!.trim(),
        ...(data.line2?.trim() ? { addressLine2: data.line2.trim() } : {}),
        city: data.city!.trim(),
        state: data.state!,
        zip: data.zip!.trim(),
        ...(data.npi?.trim() ? { npi: data.npi.trim() } : {}),
        ...(data.clia?.trim() ? { clia: data.clia.trim() } : {}),
        ...(data.placeOfService ? { posCode: data.placeOfService } : {}),
      };
      const result = await saveBillingServiceFacility(oystehrZambda, payload);
      if (!result.id) throw new Error('Service facility was not created');
      onCreated();
      onClose();
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to create service facility' }));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 980, maxWidth: '95vw' } }}>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5">Add Service Facility</Typography>
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
            {/* Left: facility */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
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
                      !value ||
                      isCLIAValid(value) ||
                      'CLIA number must be 2 digits, a "D", then 7 digits (e.g. 05D1234567)',
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
                      <TextField
                        {...params}
                        label="Place of Service"
                        error={!!fieldError}
                        helperText={fieldError?.message}
                      />
                    )}
                  />
                )}
              />
            </Box>

            {/* Right: address */}
            <AddressFields requireFullZip />
          </Box>
        </FormProvider>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit(handleSave)} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
