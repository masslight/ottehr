import { Close as CloseIcon } from '@mui/icons-material';
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
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useState } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { BillingInvoiceListItem, GetBillingInvoiceStatementResponse } from 'utils/lib/types/data/billing/billing.types';
import { createBillingInvoiceStatement, getBillingInvoiceStatement } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { formatDateTime } from '../utils/format';

export function InvoiceStatementDialog({
  invoice,
  onClose,
}: {
  invoice: BillingInvoiceListItem;
  onClose: () => void;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [statement, setStatement] = useState<GetBillingInvoiceStatementResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!oystehrZambda) return;
    let active = true;
    setLoadError(null);
    getBillingInvoiceStatement(oystehrZambda, { invoiceId: invoice.id })
      .then((data) => {
        if (active) setStatement(data);
      })
      .catch((error) => {
        if (active) setLoadError(getApiError({ error, defaultError: 'Failed to load the statement' }));
      });
    return () => {
      active = false;
    };
  }, [oystehrZambda, invoice.id, loadAttempt]);

  const generate = async (): Promise<void> => {
    if (!oystehrZambda) return;
    setGenerating(true);
    try {
      await createBillingInvoiceStatement(oystehrZambda, { invoiceId: invoice.id });
      enqueueSnackbar('Statement generation started', { variant: 'success' });
      onClose();
    } catch (error) {
      enqueueSnackbar(getApiError({ error, defaultError: 'Failed to start statement generation' }), {
        variant: 'error',
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog
      open
      onClose={generating ? undefined : onClose}
      maxWidth={false}
      PaperProps={{ sx: { width: 960, maxWidth: '95vw' } }}
    >
      <DialogTitle sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5">Patient Statement</Typography>
          <Typography variant="body2" color="text.secondary">
            {invoice.patientName}
            {statement?.generatedAt && ` · Generated ${formatDateTime(statement.generatedAt)}`}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} disabled={generating} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 0 }}>
        {loadError ? (
          <Alert severity="error" action={<Button onClick={() => setLoadAttempt((value) => value + 1)}>Retry</Button>}>
            {loadError}
          </Alert>
        ) : !statement ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} aria-label="Loading statement" />
          </Box>
        ) : (
          <Box
            component="iframe"
            title="Statement preview"
            sandbox="allow-scripts"
            srcDoc={statement.html}
            sx={{ width: '100%', height: '70vh', border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: '#fff' }}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2.5 }}>
        <Button onClick={onClose} disabled={generating} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        {statement?.pdfUrl && (
          <Button variant="outlined" href={statement.pdfUrl} target="_blank" rel="noopener">
            Download PDF
          </Button>
        )}
        <Button
          variant="contained"
          startIcon={generating ? <CircularProgress size={14} /> : undefined}
          disabled={!statement || generating}
          onClick={() => void generate()}
        >
          {generating ? 'Generating...' : statement?.generatedAt ? 'Regenerate Statement' : 'Generate Statement'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
