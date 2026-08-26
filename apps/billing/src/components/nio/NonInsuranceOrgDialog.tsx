import { Close as CloseIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { createBillingNonInsuranceOrg } from '../../api/api';
import { emptyNonInsuranceOrgForm, nioFormToInput, NonInsuranceOrgForm } from '../../constants/nonInsuranceOrg';
import { useApiClients } from '../../hooks/useAppClients';
import { NonInsuranceOrgFormFields } from './NonInsuranceOrgFormFields';

interface NonInsuranceOrgDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function NonInsuranceOrgDialog({ open, onClose, onCreated }: NonInsuranceOrgDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const methods = useForm<NonInsuranceOrgForm>({ defaultValues: emptyNonInsuranceOrgForm() });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    reset(emptyNonInsuranceOrgForm());
  }, [open, reset]);

  const handleSave = async (data: NonInsuranceOrgForm): Promise<void> => {
    if (!oystehrZambda) return;
    setError(null);
    try {
      const result = await createBillingNonInsuranceOrg(oystehrZambda, nioFormToInput(data));
      if (!result.id) throw new Error('Non-insurance organization was not created');
      onCreated();
      onClose();
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to create non-insurance organization' }));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 1080, maxWidth: '95vw' } }}>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5">Add Non-Insurance Organization</Typography>
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
          {/* Top margin keeps the first field's floated label from being clipped by the
              DialogContent scroll edge (same treatment as AddServiceFacilityDialog). */}
          <Box sx={{ mt: 1 }}>
            <NonInsuranceOrgFormFields />
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
