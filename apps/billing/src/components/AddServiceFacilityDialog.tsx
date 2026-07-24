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
import { getApiError } from 'utils';
import { saveBillingServiceFacility } from '../api/api';
import {
  emptyServiceFacilityForm,
  ServiceFacilityForm,
  serviceFacilityToSaveInput,
} from '../constants/serviceFacility';
import { useApiClients } from '../hooks/useAppClients';
import { AddressFields } from './AddressFields';
import { ServiceFacilityFields } from './ServiceFacilityFields';

interface AddServiceFacilityDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function AddServiceFacilityDialog({ open, onClose, onCreated }: AddServiceFacilityDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const methods = useForm<ServiceFacilityForm>({ defaultValues: emptyServiceFacilityForm() });
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

  const handleSave = async (data: ServiceFacilityForm): Promise<void> => {
    if (!oystehrZambda) return;
    setError(null);
    try {
      const result = await saveBillingServiceFacility(oystehrZambda, serviceFacilityToSaveInput(data));
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
              <ServiceFacilityFields />
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
              <AddressFields requireFullZip />
            </Box>
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
