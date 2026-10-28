import {
  Close as CloseIcon,
  ContentCopy as ContentCopyIcon,
  DynamicForm as DynamicFormIcon,
  FileDownloadOutlined as FileDownloadIcon,
} from '@mui/icons-material';
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
} from '@mui/material';
import { ReactElement, useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { ClaimDetailResponse } from 'utils/lib/types/data/billing/billing.types';
import { downloadTextFile } from '../utils/downloadFile';
import { ClaimSubmissionFields, ClaimSubmissionForm, ClaimSubmissionFormDefaults } from './ClaimSubmissionFields';

interface ExportX12DialogProps {
  open: boolean;
  onClose: () => void;
  fileName: string;
  type: 'claim' | 'era';
  x12Provider: (params: ClaimSubmissionForm) => Promise<string>;
  claim?: ClaimDetailResponse;
}

export function ExportX12Dialog({
  open,
  onClose,
  fileName,
  type,
  claim,
  x12Provider,
}: ExportX12DialogProps): ReactElement {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [x12, setX12] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const claimMethods = useForm<ClaimSubmissionForm>({ defaultValues: ClaimSubmissionFormDefaults });
  const [showClaimFields, setShowClaimFields] = useState(type === 'claim' && !!claim);

  useEffect(() => {
    if (!open) return undefined;

    setError(null);
    setX12(null);
    setCopied(false);

    if (type === 'claim') return undefined;

    setLoading(true);
    let cancelled = false;
    void (async () => {
      try {
        const x12 = await x12Provider(ClaimSubmissionFormDefaults);
        if (!cancelled) setX12(x12);
      } catch (err) {
        if (!cancelled) {
          setError(
            getApiError({
              error: err,
              defaultError: 'Failed to export X12',
            })
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, type, x12Provider]);

  useEffect(() => {
    setShowClaimFields(type === 'claim' && !!claim);
  }, [claim, type]);

  useEffect(() => {
    claimMethods.reset();
  }, [claimMethods, open]);

  const handleGenerate = useCallback(
    async (values: ClaimSubmissionForm) => {
      setLoading(true);
      try {
        const x12 = await x12Provider(values);
        setX12(x12);
      } catch (err) {
        setError(
          getApiError({
            error: err,
            defaultError: 'Failed to export X12',
          })
        );
      } finally {
        setLoading(false);
      }
    },
    [x12Provider]
  );

  const handleCopy = async (): Promise<void> => {
    if (!x12) return;
    try {
      await navigator.clipboard.writeText(x12);
      setCopied(true);
    } catch (err) {
      setError(
        getApiError({
          error: err,
          defaultError: 'Failed to copy X12',
        })
      );
    }
  };

  const handleDownload = (): void => {
    if (!x12) return;
    downloadTextFile(fileName, x12);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: 720,
          maxWidth: '95vw',
        },
      }}
    >
      <DialogTitle
        sx={{
          px: 3,
          pt: 3,
          pb: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        Export X12
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent
        sx={{
          px: 3,
          pb: 0,
        }}
      >
        {showClaimFields && claim ? (
          <FormProvider {...claimMethods}>
            <ClaimSubmissionFields claim={claim} />
          </FormProvider>
        ) : (
          <></>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              py: 6,
            }}
          >
            <CircularProgress />
          </Box>
        )}
        {x12 != null && (
          <TextField
            label="Raw X12"
            aria-label="Raw X12"
            sx={{ mt: 1 }}
            InputLabelProps={{ shrink: true }}
            multiline
            fullWidth
            minRows={12}
            maxRows={20}
            value={x12}
            InputProps={{
              readOnly: true,
              sx: {
                fontFamily: 'monospace',
                fontSize: 12,
              },
            }}
          />
        )}
      </DialogContent>
      <DialogActions
        sx={{
          px: 3,
          py: 2.5,
        }}
      >
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
          Close
        </Button>
        <Button startIcon={<ContentCopyIcon />} onClick={() => void handleCopy()} disabled={x12 == null}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button
          variant={!showClaimFields ? 'contained' : undefined}
          startIcon={<FileDownloadIcon />}
          onClick={handleDownload}
          disabled={x12 == null}
        >
          Download
        </Button>
        {showClaimFields ? (
          <Button
            variant="contained"
            startIcon={<DynamicFormIcon />}
            onClick={claimMethods.handleSubmit(handleGenerate)}
          >
            Generate X12
          </Button>
        ) : (
          <></>
        )}
      </DialogActions>
    </Dialog>
  );
}
