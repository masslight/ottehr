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
  TextField,
  Typography,
} from '@mui/material';
import { Bundle } from 'fhir/r4b';
import { ReactElement, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { getApiError, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import { importEra } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import AlertDialog from './AlertDialog';

interface Props {
  onClose: () => void;
}

export function ImportEraDialog({ onClose }: Props): ReactElement {
  const { oystehrZambda } = useApiClients();
  const methods = useForm<{ era: string | null }>({ defaultValues: { era: null } });
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const handleImport = async (data: { era: string | null }): Promise<void> => {
    if (!oystehrZambda) return;
    setError(null);
    try {
      const result = await importEra(oystehrZambda, {
        era: data.era!,
      });
      let processedErasCount = 0;
      if (result.resourceType === 'Bundle') {
        const dataBundle = result as Bundle;
        processedErasCount =
          dataBundle.entry?.filter((entry) => entry.resource?.resourceType === 'ClaimResponse')?.length ?? 0;
      }
      setResultMessage(`Imported ${processedErasCount} ERAs`);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to import ERA' }));
    }
  };

  return (
    <>
      <Dialog
        open={resultMessage == null}
        onClose={onClose}
        maxWidth={false}
        PaperProps={{ sx: { width: 680, maxWidth: '95vw' } }}
      >
        <DialogTitle
          sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography variant="h5">Import ERA</Typography>
          <IconButton size="small" onClick={onClose} aria-label="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 0 }}>
          <FormProvider {...methods}>
            <Box sx={{ display: 'flex', gap: 5, mt: 1 }}>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Controller
                  name="era"
                  control={control}
                  rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                  render={({ field, fieldState: { error: fieldError } }) => (
                    <TextField
                      size="small"
                      fullWidth
                      multiline
                      label="ERA in X12 Format *"
                      value={field.value}
                      minRows={20}
                      onChange={(e) => field.onChange(e.target.value)}
                      error={!!fieldError}
                      helperText={fieldError?.message}
                    />
                  )}
                />
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}
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
            onClick={handleSubmit(handleImport)}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Importing...' : 'Import'}
          </Button>
        </DialogActions>
      </Dialog>
      {resultMessage ? <AlertDialog title="Import result" text={resultMessage} onClose={onClose} /> : null}
    </>
  );
}
