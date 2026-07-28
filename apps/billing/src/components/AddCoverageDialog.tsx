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
import { BillingInsuranceType, getApiError } from 'utils';
import { createBillingCoverage } from '../api/api';
import { CoverageForm, coverageToCreateInput, emptyCoverageForm } from '../constants/coverage';
import { useApiClients } from '../hooks/useAppClients';
import { CoverageFields } from './CoverageFields';

interface AddCoverageDialogProps {
  open: boolean;
  patientId: string;
  defaultType: BillingInsuranceType;
  // Insurance types already held by active coverages (disabled / blocked in the form).
  unavailableTypes?: BillingInsuranceType[];
  onClose: () => void;
  onCreated: () => void;
}

export function AddCoverageDialog({
  open,
  patientId,
  defaultType,
  unavailableTypes = [],
  onClose,
  onCreated,
}: AddCoverageDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const methods = useForm<CoverageForm>({ defaultValues: emptyCoverageForm(defaultType) });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    reset();
    setError(null);
  }, [open, reset]);

  const handleSave = async (data: CoverageForm): Promise<void> => {
    if (!oystehrZambda) return;
    setError(null);
    try {
      const result = await createBillingCoverage(oystehrZambda, coverageToCreateInput(data, patientId));
      if (!result.id) throw new Error('Coverage was not created');
      onCreated();
      onClose();
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to create coverage' }));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 680, maxWidth: '95vw' } }}>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5">Add Insurance Coverage</Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 0 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <FormProvider {...methods}>
          <Box sx={{ mt: 0.5 }}>
            <CoverageFields unavailableTypes={unavailableTypes} />
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
          {isSubmitting ? 'Saving...' : 'Save coverage'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
