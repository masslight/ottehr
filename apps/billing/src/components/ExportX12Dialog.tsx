import {
  Close as CloseIcon,
  ContentCopy as ContentCopyIcon,
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
import { ReactElement, useEffect, useState } from 'react';
import { ClaimDetailResponse, getApiError } from 'utils';
import { exportClaimX12 } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { downloadTextFile } from '../utils/downloadTextFile';

interface ExportX12DialogProps {
  open: boolean;
  onClose: () => void;
  claimId: string;
  claimType: ClaimDetailResponse['type'];
}

export function ExportX12Dialog({ open, onClose, claimId, claimType }: ExportX12DialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [x12, setX12] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const formatLabel = claimType === 'professional' ? '837P' : '837I';
  const fileName = `claim-${claimId}-${formatLabel.toLowerCase()}.txt`;

  useEffect(() => {
    if (!open) return undefined;

    setLoading(true);
    setError(null);
    setX12(null);
    setCopied(false);

    if (!oystehrZambda) {
      setError('Client not ready');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    void (async () => {
      try {
        const data = await exportClaimX12(oystehrZambda, { claimId });
        if (!cancelled) setX12(data.x12);
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
  }, [open, oystehrZambda, claimId]);

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
          pb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {`Export X12 (${formatLabel})`}
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
        <Button variant="contained" startIcon={<FileDownloadIcon />} onClick={handleDownload} disabled={x12 == null}>
          Download
        </Button>
      </DialogActions>
    </Dialog>
  );
}
