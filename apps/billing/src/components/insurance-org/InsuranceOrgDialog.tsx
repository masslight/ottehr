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
import { createBillingInsuranceOrg } from '../../api/api';
import { emptyInsuranceOrgForm, InsuranceOrgForm, insuranceOrgFormToInput } from '../../constants/insuranceOrg';
import { useApiClients } from '../../hooks/useAppClients';
import { InsuranceOrgFormFields } from './InsuranceOrgFormFields';

interface InsuranceOrgDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function InsuranceOrgDialog({ open, onClose, onCreated }: InsuranceOrgDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const methods = useForm<InsuranceOrgForm>({ defaultValues: emptyInsuranceOrgForm() });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    reset(emptyInsuranceOrgForm());
  }, [open, reset]);

  const handleSave = async (data: InsuranceOrgForm): Promise<void> => {
    if (!oystehrZambda) return;
    setError(null);
    try {
      const result = await createBillingInsuranceOrg(oystehrZambda, insuranceOrgFormToInput(data));
      if (!result.id) throw new Error('Insurance organization was not created');
      onCreated();
      onClose();
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to create insurance organization' }));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 560, maxWidth: '95vw' } }}>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5">Add Insurance Organization</Typography>
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
          <Box sx={{ mt: 1 }}>
            <InsuranceOrgFormFields />
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
