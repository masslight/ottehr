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
import { createBillingProvider } from '../api/api';
import { emptyProviderForm, ProviderForm, ProviderRole, providerToCreateInput } from '../constants/provider';
import { useApiClients } from '../hooks/useAppClients';
import { AddressFields } from './AddressFields';
import { ProviderFields } from './ProviderFields';

interface AddProviderDialogProps {
  open: boolean;
  defaultRole: ProviderRole;
  onClose: () => void;
  onCreated: () => void;
}

export function AddProviderDialog({ open, defaultRole, onClose, onCreated }: AddProviderDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const methods = useForm<ProviderForm>({
    defaultValues: emptyProviderForm(defaultRole),
  });
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

  const handleSave = async (data: ProviderForm): Promise<void> => {
    if (!oystehrZambda) return;
    if (!data.renders && !data.bills) {
      return setError('Provider must render or bill');
    }
    setError(null);
    try {
      const result = await createBillingProvider(oystehrZambda, providerToCreateInput(data));
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
              <ProviderFields />
            </Box>

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
