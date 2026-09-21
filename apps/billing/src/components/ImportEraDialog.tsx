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
import { ReactElement, useEffect, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { MIME_TYPES } from 'utils/lib/utils/file';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';
import { importEra } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { readEraFile } from '../utils/eraFile';
import AlertDialog from './AlertDialog';
import { DropzoneField } from './DropzoneField';

const ERA_FILE_ACCEPT = {
  [MIME_TYPES.TXT]: ['.835', '.txt', '.edi', '.rem', '.dat'],
};

interface Props {
  onClose: () => void;
}

interface EraFormValues {
  era: string | null;
  eraFile: File | null;
}

export function ImportEraDialog({ onClose }: Props): ReactElement {
  const { oystehrZambda } = useApiClients();
  const methods = useForm<EraFormValues>({
    defaultValues: {
      era: null,
      eraFile: null,
    },
  });
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    setError: setFieldError,
    clearErrors,
    formState: { isSubmitting },
  } = methods;

  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const eraFile = watch('eraFile');
  useEffect(() => {
    if (!eraFile) return;
    void (async () => {
      const result = await readEraFile(eraFile);
      if (!result.ok) {
        setFieldError('eraFile', {
          type: 'manual',
          message: result.error,
        });
        return;
      }
      clearErrors('eraFile');
      setValue('era', result.text, {
        shouldValidate: true,
        shouldDirty: true,
      });
    })();
  }, [eraFile, setValue, setFieldError, clearErrors]);

  const handleImport = async (data: EraFormValues): Promise<void> => {
    if (!oystehrZambda) return;
    setError(null);
    try {
      const result = await importEra(oystehrZambda, {
        era: data.era!,
      });
      let processedMatchedClaimsCount = 0;
      let processedUnmatchedClaimsCount = 0;
      if (result.resourceType === 'Bundle') {
        const dataBundle = result as Bundle;
        processedMatchedClaimsCount =
          dataBundle.entry?.filter(
            (entry) =>
              entry.resource?.resourceType === 'ClaimResponse' && !entry.resource.request?.reference?.startsWith('#')
          )?.length ?? 0;
        processedUnmatchedClaimsCount =
          dataBundle.entry?.filter(
            (entry) =>
              entry.resource?.resourceType === 'ClaimResponse' && entry.resource.request?.reference?.startsWith('#')
          )?.length ?? 0;
      }
      setResultMessage(
        `ERA successfully imported with ${processedMatchedClaimsCount} matched claims and ${processedUnmatchedClaimsCount} unmatched claims.`
      );
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
                <DropzoneField name="eraFile" multiple={false} accept={ERA_FILE_ACCEPT} />
                <Typography variant="body2" color="text.secondary">
                  Or paste the ERA text below.
                </Typography>
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
