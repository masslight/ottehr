import { Close as CloseIcon, Save as SaveIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { CreateBillingPatientInput, getApiError, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import { createBillingPatient } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { buildAddressInput } from '../utils/format';
import { AddressFields } from './AddressFields';

// The create screen only picks references — patient, coverage, and providers are chosen as-is.
// Tweaking their underlying details (names, NPIs, addresses, etc.) is done afterward in the claim
// editing UI, which keeps this screen focused on assembling a claim from existing resources.
interface AddPatientForm {
  firstName: string | null;
  lastName: string | null;
  dob: string | null;
  gender: string | null;
  phone: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

const defaultValues: AddPatientForm = {
  firstName: null,
  lastName: null,
  dob: null,
  gender: null,
  phone: null,
  line1: null,
  line2: null,
  city: null,
  state: null,
  zip: null,
};

interface AddPatientDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function AddPatientDialog({ open, onClose, onCreated }: AddPatientDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const methods = useForm<AddPatientForm>({ defaultValues });
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

  const handleSave = async (data: AddPatientForm): Promise<void> => {
    if (!oystehrZambda) return;
    setError(null);
    try {
      const address = buildAddressInput(data.line1, data.line2, data.city, data.state, data.zip);
      const payload: CreateBillingPatientInput = {
        firstName: data.firstName!.trim(),
        lastName: data.lastName!.trim(),
        ...(data.dob ? { dob: data.dob } : {}),
        ...(data.gender ? { gender: data.gender as CreateBillingPatientInput['gender'] } : {}),
        ...(data.phone?.trim() ? { phone: data.phone.trim() } : {}),
        ...(address ? { address } : {}),
      };
      const result = await createBillingPatient(oystehrZambda, payload);
      if (!result.id) throw new Error('Patient was not created');
      onCreated();
      onClose();
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to create patient' }));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 980, maxWidth: '95vw' } }}>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5">Add Patient</Typography>
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
            {/* Left: demographics */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, mt: 0.5 }}>
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
                      autoFocus
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

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Controller
                  name="dob"
                  control={control}
                  rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                  render={({ field, fieldState: { error: fieldError } }) => (
                    <TextField
                      label="Date of birth *"
                      size="small"
                      fullWidth
                      type="date"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      error={!!fieldError}
                      helperText={fieldError?.message}
                    />
                  )}
                />
                <Controller
                  name="gender"
                  control={control}
                  rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                  render={({ field, fieldState: { error: fieldError } }) => (
                    <FormControl size="small" fullWidth>
                      <InputLabel id="gender-select-label" error={!!fieldError}>
                        Gender *
                      </InputLabel>
                      <Select
                        aria-describedby={fieldError ? 'gender-helper-text' : undefined}
                        label="Gender *"
                        labelId="gender-select-label"
                        size="small"
                        fullWidth
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        error={!!fieldError}
                      >
                        <MenuItem value="male">Male</MenuItem>
                        <MenuItem value="female">Female</MenuItem>
                        <MenuItem value="other">Other</MenuItem>
                        <MenuItem value="unknown">Unknown</MenuItem>
                      </Select>
                      {fieldError ? (
                        <FormHelperText id={`gender-helper-text`} error={true}>
                          {fieldError?.message}
                        </FormHelperText>
                      ) : (
                        <></>
                      )}
                    </FormControl>
                  )}
                />
              </Box>

              <Controller
                name="phone"
                control={control}
                render={({ field, fieldState: { error: fieldError } }) => (
                  <TextField
                    label="Phone number"
                    size="small"
                    fullWidth
                    placeholder="(555) 000-0000"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    error={!!fieldError}
                    helperText={fieldError?.message}
                  />
                )}
              />
            </Box>

            {/* Right: address */}
            <AddressFields />
          </Box>
        </FormProvider>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2.5 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={isSubmitting ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
          onClick={handleSubmit(handleSave)}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save patient'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
