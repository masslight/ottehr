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
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { NioSubmission } from 'utils/lib/types/data/billing/non-insurance-org.schemas';
import { NIO_COVERAGE_CATEGORY_LABELS, NioCoverageDetail } from 'utils/lib/types/data/billing/non-insurance-org.types';
import { createBillingNioInvoice, previewBillingNioInvoice, searchBillingNonInsuranceOrgs } from '../api/api';
import { formatNioAddress, NIO_SUBMISSION_MECHANISM_LABELS } from '../constants/nonInsuranceOrg';
import { useApiClients } from '../hooks/useAppClients';
import { base64ToBlob, downloadUrl } from '../utils/downloadFile';

function deliveryDetails(submission: NioSubmission): [string, string][] {
  const details: [string, string | undefined][] = [
    [
      'Preferred method',
      submission.preferredMechanism && NIO_SUBMISSION_MECHANISM_LABELS[submission.preferredMechanism],
    ],
    ['Email', submission.email],
    ['Fax', submission.fax],
    ['Portal notes', submission.portalNotes],
    ['Mail address', formatNioAddress(submission.mailAddress)],
  ];
  return details.filter((detail): detail is [string, string] => !!detail[1]);
}

function coverageLabel(coverage: NioCoverageDetail): string {
  if (coverage.category === 'other' && coverage.name) return coverage.name;
  return NIO_COVERAGE_CATEGORY_LABELS[coverage.category];
}

function DeliveryInfo({ nioId, nioName }: { nioId: string; nioName: string }): ReactElement {
  const { oystehrZambda } = useApiClients();
  const nio = useQuery({
    queryKey: ['billing-non-insurance-org', nioId],
    enabled: Boolean(oystehrZambda),
    retry: false,
    queryFn: async () =>
      (
        await searchBillingNonInsuranceOrgs(oystehrZambda!, {
          nioId,
        })
      ).organizations[0] ?? null,
  });

  const deliveries = (nio.data?.covers ?? []).flatMap((coverage) => {
    const details = coverage.submission ? deliveryDetails(coverage.submission) : [];
    if (details.length === 0) return [];
    return [
      {
        label: coverageLabel(coverage),
        details,
      },
    ];
  });

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        p: 2,
      }}
    >
      <Typography variant="subtitle2">Delivery</Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          mb: 1,
        }}
      >
        Creating the invoice downloads its PDF, it won't automatically send it to {nioName}.
      </Typography>
      {nio.isPending ? (
        <CircularProgress size={20} aria-label="Loading delivery details" />
      ) : nio.isError ? (
        <Alert severity="warning">
          {getApiError({
            error: nio.error,
            defaultError: 'Failed to load the delivery details',
          })}
        </Alert>
      ) : deliveries.length === 0 ? (
        <Typography variant="body2">No delivery details on file.</Typography>
      ) : (
        <Stack spacing={1.5}>
          {deliveries.map(({ label: coverage, details }) => (
            <Stack key={coverage} spacing={0.5}>
              <Typography variant="body2" fontWeight="bold">
                {coverage}
              </Typography>
              {details.map(([label, value]) => (
                <Typography key={label} variant="body2">
                  <strong>{label}:</strong> {value}
                </Typography>
              ))}
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );
}

export function NioInvoiceDialog({
  claimIds,
  onClose,
  onCreated,
}: {
  claimIds: string[];
  onClose: () => void;
  onCreated: () => void;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  // One key per dialog, so retrying a failed create returns the invoice it may already have made.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [notDownloadedInvoiceNumber, setNotDownloadedInvoiceNumber] = useState<string | null>(null);
  const close = notDownloadedInvoiceNumber ? onCreated : onClose;
  const idleLabel = notDownloadedInvoiceNumber ? 'Download Again' : 'Create Invoice';

  const preview = useQuery({
    queryKey: ['billing-nio-invoice-preview', claimIds],
    enabled: Boolean(oystehrZambda),
    retry: false,
    gcTime: 0,
    queryFn: () =>
      previewBillingNioInvoice(oystehrZambda!, {
        claimIds,
      }),
  });

  const pdfUrl = useMemo(
    () => (preview.data ? URL.createObjectURL(base64ToBlob(preview.data.pdfBase64, 'application/pdf')) : undefined),
    [preview.data]
  );
  useEffect(() => {
    if (!pdfUrl) return undefined;
    return () => URL.revokeObjectURL(pdfUrl);
  }, [pdfUrl]);

  const create = async (): Promise<void> => {
    if (!oystehrZambda) return;
    setCreating(true);
    setCreateError(null);
    try {
      const invoice = await createBillingNioInvoice(oystehrZambda, {
        claimIds,
        idempotencyKey,
      });
      try {
        await downloadUrl(`${invoice.invoiceNumber}.pdf`, invoice.pdfUrl);
      } catch {
        setNotDownloadedInvoiceNumber(invoice.invoiceNumber);
        setCreating(false);
        return;
      }
      enqueueSnackbar(`Invoice ${invoice.invoiceNumber} created`, {
        variant: 'success',
      });
      onCreated();
    } catch (error) {
      setCreateError(
        getApiError({
          error,
          defaultError: 'Failed to create the invoice',
        })
      );
      setCreating(false);
    }
  };

  return (
    <Dialog
      open
      onClose={creating ? undefined : close}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: 960,
          maxWidth: '95vw',
        },
      }}
      aria-labelledby="nio-invoice-dialog-title"
    >
      <DialogTitle
        id="nio-invoice-dialog-title"
        sx={{
          px: 3,
          pt: 3,
          pb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box component="span">
          <Typography component="span" variant="h5" display="block">
            Create NIO Invoice
          </Typography>
          <Typography component="span" variant="body2" color="text.secondary" display="block">
            {preview.data ? `${preview.data.recipient.name} · ` : ''}
            {claimIds.length} claim(s)
          </Typography>
        </Box>
        <IconButton size="small" onClick={close} disabled={creating} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent
        sx={{
          px: 3,
          pb: 0,
        }}
      >
        <Stack spacing={2}>
          {createError && <Alert severity="error">{createError}</Alert>}
          {notDownloadedInvoiceNumber && (
            <Alert severity="warning">
              Invoice {notDownloadedInvoiceNumber} was created, but its PDF didn't download.
            </Alert>
          )}
          {preview.isPending ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                py: 6,
              }}
            >
              <CircularProgress size={28} aria-label="Loading invoice preview" />
            </Box>
          ) : preview.isError ? (
            <Alert severity="error" action={<Button onClick={() => void preview.refetch()}>Retry</Button>}>
              {getApiError({
                error: preview.error,
                defaultError: 'Failed to load the invoice preview',
              })}
            </Alert>
          ) : (
            <>
              <DeliveryInfo nioId={preview.data.recipient.id} nioName={preview.data.recipient.name} />
              <iframe
                src={pdfUrl}
                title="Invoice preview"
                style={{
                  width: '100%',
                  height: '60vh',
                  border: '1px solid rgba(0, 0, 0, 0.12)',
                  borderRadius: 4,
                }}
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions
        sx={{
          px: 3,
          py: 2.5,
        }}
      >
        <Button
          onClick={close}
          disabled={creating}
          sx={{
            color: 'text.secondary',
          }}
        >
          {notDownloadedInvoiceNumber ? 'Close' : 'Cancel'}
        </Button>
        <Button
          variant="contained"
          startIcon={creating ? <CircularProgress size={14} /> : undefined}
          disabled={!preview.data || creating}
          onClick={() => void create()}
        >
          {creating ? 'Creating...' : idleLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
