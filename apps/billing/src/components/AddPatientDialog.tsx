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
  IconButton,
  Typography,
} from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { getApiError } from 'utils';
import { createBillingPatient } from '../api/api';
import { emptyPatientForm, PatientForm, patientToCreateInput } from '../constants/patient';
import { useApiClients } from '../hooks/useAppClients';
import { AddressFields } from './AddressFields';
import { DemographicFields } from './DemographicFields';

// The create screen only picks references — patient, coverage, and providers are chosen as-is.
// Tweaking their underlying details (names, NPIs, addresses, etc.) is done afterward in the claim
// editing UI, which keeps this screen focused on assembling a claim from existing resources.

interface AddPatientDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function AddPatientDialog({ open, onClose, onCreated }: AddPatientDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const methods = useForm<PatientForm>({ defaultValues: emptyPatientForm() });
  const {
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

  const handleSave = async (data: PatientForm): Promise<void> => {
    if (!oystehrZambda) return;
    setError(null);
    try {
      const result = await createBillingPatient(oystehrZambda, patientToCreateInput(data));
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
            <DemographicFields />

            {/* Right: address */}
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 2.5,
                borderLeft: 1,
                borderColor: 'divider',
                pl: 5,
              }}
            >
              <AddressFields />
            </Box>
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
