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
import { createBillingCustomInsuranceOrg } from '../../api/api';
import {
  CustomInsuranceOrgForm,
  emptyInsuranceOrgForm,
  insuranceOrgFormToInput,
} from '../../constants/customInsuranceOrg';
import { useApiClients } from '../../hooks/useAppClients';
import { CustomInsuranceOrgFormFields } from './CustomInsuranceOrgFormFields';

interface CustomInsuranceOrgDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CustomInsuranceOrgDialog({ open, onClose, onCreated }: CustomInsuranceOrgDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const methods = useForm<CustomInsuranceOrgForm>({ defaultValues: emptyInsuranceOrgForm() });
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

  const handleSave = async (data: CustomInsuranceOrgForm): Promise<void> => {
    if (!oystehrZambda) return;
    setError(null);
    try {
      const result = await createBillingCustomInsuranceOrg(oystehrZambda, insuranceOrgFormToInput(data));
      if (!result.id) throw new Error('Insurance organization was not created');
      onCreated();
      onClose();
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to create insurance organization' }));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 1080, maxWidth: '95vw' } }}>
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
            <CustomInsuranceOrgFormFields />
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
