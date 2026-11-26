import { ArrowBack as ArrowBackIcon, Download as DownloadIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { ReactElement, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { BillingInvoiceDetail, BillingInvoicePayment } from 'utils/lib/types/data/billing/billing.types';
import { CLAIM_STATUS_FIELDS_BY_KEY, getActiveStatusGroup } from 'utils/lib/types/data/billing/claim-status';
import { formatCurrency } from 'utils/lib/utils/convert';
import { getBillingInvoice } from '../api/api';
import { ClaimStatusValueChip } from '../components/ClaimStatusValueChip';
import { CollectInvoiceCardPaymentDialog } from '../components/CollectInvoiceCardPaymentDialog';
import { InvoiceStatusChip } from '../components/InvoiceStatusChip';
import { ReadOnlySection, thSx } from '../components/ReadOnlySection';
import { RecordInvoicePaymentDialog } from '../components/RecordInvoicePaymentDialog';
import { Row } from '../components/Row';
import { VoidInvoiceDialog } from '../components/VoidInvoiceDialog';
import { invoicePaymentMethodLabel } from '../constants/invoice';
import { useApiClients } from '../hooks/useAppClients';
import { downloadUrl } from '../utils/downloadFile';
import { formatDate } from '../utils/format';

interface DownloadableFile {
  fileName: string;
  url: string;
}

const formatPaymentLine = ({ method, reference, amount }: BillingInvoicePayment): string =>
  `${invoicePaymentMethodLabel(method)}${reference ? ` #${reference}` : ''} - ${formatCurrency(amount)}`;

function ClaimsTable({ invoice }: { invoice: BillingInvoiceDetail }): ReactElement {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={thSx}>Patient</TableCell>
          <TableCell sx={thSx}>Date of Service</TableCell>
          <TableCell sx={thSx}>Stage</TableCell>
          <TableCell sx={thSx}>Status</TableCell>
          <TableCell sx={thSx} align="right">
            Amount
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {invoice.claims.map((claim) => {
          const statusFieldKey = getActiveStatusGroup(claim.arStage)?.primaryFieldKey;
          return (
            <TableRow key={claim.claimId}>
              <TableCell>
                {claim.patientId ? (
                  <Link component={RouterLink} to={`/claims/${claim.claimId}`} underline="hover">
                    {claim.patientName || '-'}
                  </Link>
                ) : (
                  'Claim not found'
                )}
              </TableCell>
              <TableCell>{formatDate(claim.serviceDate)}</TableCell>
              <TableCell>
                <ClaimStatusValueChip field={CLAIM_STATUS_FIELDS_BY_KEY.arStage} code={claim.arStage} />
              </TableCell>
              <TableCell>
                {statusFieldKey && (
                  <ClaimStatusValueChip field={CLAIM_STATUS_FIELDS_BY_KEY[statusFieldKey]} code={claim.status} />
                )}
              </TableCell>
              <TableCell align="right">{formatCurrency(claim.amount)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function PaymentLine({
  payment,
  onDownloadAttachment,
}: {
  payment: BillingInvoicePayment;
  onDownloadAttachment: () => void;
}): ReactElement {
  return (
    <>
      <span>{formatPaymentLine(payment)}</span>
      {payment.attachment && (
        <>
          {' · '}
          <Link component="button" type="button" underline="hover" onClick={onDownloadAttachment}>
            {payment.attachment.fileName}
          </Link>
        </>
      )}
    </>
  );
}

function InvoiceSections({
  invoice,
  onDownloadAttachment,
}: {
  invoice: BillingInvoiceDetail;
  onDownloadAttachment: (paymentId: string) => void;
}): ReactElement {
  return (
    <>
      <ReadOnlySection title="Details">
        <Row
          label="Billed to"
          value={
            invoice.recipient && (
              <Link
                component={RouterLink}
                to={`/non-insurance-organizations/${invoice.recipient.id}`}
                underline="hover"
              >
                {invoice.recipient.name}
              </Link>
            )
          }
        />
        <Row label="Issue date" value={formatDate(invoice.issueDate)} />
        <Row label="Due date" value={formatDate(invoice.dueDate)} />
        <Row label="Amount" value={formatCurrency(invoice.amount)} />
        <Row
          label="Balance"
          value={invoice.balance !== undefined && formatCurrency(invoice.balance)}
          hideBorder={invoice.status !== 'cancelled'}
        />
        {invoice.status === 'cancelled' && <Row label="Void reason" value={invoice.voidReason} hideBorder />}
      </ReadOnlySection>
      <ReadOnlySection title="Payments">
        {invoice.payments.length === 0
          ? 'No payments recorded.'
          : invoice.payments.map((payment, index) => (
              <Row
                key={payment.paymentId}
                label={formatDate(payment.paymentDate)}
                value={
                  <PaymentLine payment={payment} onDownloadAttachment={() => onDownloadAttachment(payment.paymentId)} />
                }
                hideBorder={index === invoice.payments.length - 1}
              />
            ))}
      </ReadOnlySection>
      <ReadOnlySection title="Claims on this invoice">
        <ClaimsTable invoice={invoice} />
      </ReadOnlySection>
    </>
  );
}

export default function InvoiceDetail(): ReactElement {
  const { id: invoiceId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [collectingCardPayment, setCollectingCardPayment] = useState(false);
  const [voiding, setVoiding] = useState(false);

  const invoice = useQuery({
    queryKey: ['billing-invoice', invoiceId],
    enabled: Boolean(oystehrZambda && invoiceId),
    retry: false,
    // The PDF link is presigned and expires.
    gcTime: 0,
    queryFn: () =>
      getBillingInvoice(oystehrZambda!, {
        invoiceId: invoiceId!,
      }),
  });

  const isLocked = !(
    invoice.data?.status === 'issued' &&
    invoice.data.amount > 0 &&
    invoice.data.balance === invoice.data.amount
  );
  const isVoid = invoice.data?.status === 'cancelled';

  const download = async ({
    pick,
    missing,
    defaultError,
  }: {
    pick: (detail: BillingInvoiceDetail) => DownloadableFile | undefined;
    missing: string;
    defaultError: string;
  }): Promise<void> => {
    setDownloading(true);
    setDownloadError(null);
    try {
      // presigned link might have expired
      const { data } = await invoice.refetch({
        throwOnError: true,
      });
      const file = data && pick(data);
      if (!file) throw new Error(missing);
      await downloadUrl(file.fileName, file.url);
    } catch (error) {
      setDownloadError(
        getApiError({
          error,
          defaultError,
        })
      );
    } finally {
      setDownloading(false);
    }
  };

  const downloadPdf = (): Promise<void> =>
    download({
      pick: ({ pdfUrl, number, id }) =>
        pdfUrl
          ? {
              fileName: `${number ?? id}.pdf`,
              url: pdfUrl,
            }
          : undefined,
      missing: 'This invoice has no PDF',
      defaultError: "The invoice PDF didn't download",
    });

  const downloadAttachment = (paymentId: string): Promise<void> =>
    download({
      pick: ({ payments }) => payments.find((payment) => payment.paymentId === paymentId)?.attachment,
      missing: 'This payment has no attachment',
      defaultError: "The payment attachment didn't download",
    });

  return (
    <Box
      sx={{
        p: 0,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          mb: 2,
          flexWrap: 'wrap',
        }}
      >
        <IconButton onClick={() => navigate('/invoices')} size="small" aria-label="Back to invoices">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" color="primary.dark" fontWeight={600}>
          {invoice.data?.number ?? 'Invoice'}
        </Typography>
        {invoice.data && <InvoiceStatusChip status={invoice.data.status} pastDue={invoice.data.pastDue} />}
        <Box
          sx={{
            flexGrow: 1,
          }}
        />
        <Button variant="contained" disabled={isLocked} onClick={() => setRecordingPayment(true)}>
          Record payment
        </Button>
        <Button variant="outlined" disabled={isLocked} onClick={() => setCollectingCardPayment(true)}>
          Collect card payment
        </Button>
        <Button variant="outlined" color="error" disabled={isLocked} onClick={() => setVoiding(true)}>
          Void invoice
        </Button>
        <Tooltip title={isVoid ? 'This invoice is void, so its PDF is no longer available' : ''}>
          <span>
            <Button
              startIcon={downloading ? <CircularProgress size={14} /> : <DownloadIcon />}
              disabled={!invoice.data?.pdfUrl || downloading || isVoid}
              onClick={() => void downloadPdf()}
            >
              Download invoice
            </Button>
          </span>
        </Tooltip>
      </Box>
      {downloadError && (
        <Alert
          severity="error"
          sx={{
            mb: 2,
          }}
        >
          {downloadError}
        </Alert>
      )}
      {invoice.isPending ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            py: 6,
          }}
        >
          <CircularProgress size={28} aria-label="Loading invoice" />
        </Box>
      ) : invoice.isError ? (
        <Alert severity="error" action={<Button onClick={() => void invoice.refetch()}>Retry</Button>}>
          {getApiError({
            error: invoice.error,
            defaultError: 'Failed to load the invoice',
          })}
        </Alert>
      ) : (
        <InvoiceSections
          invoice={invoice.data}
          onDownloadAttachment={(paymentId) => void downloadAttachment(paymentId)}
        />
      )}
      {invoice.data && (
        <>
          <RecordInvoicePaymentDialog
            open={recordingPayment}
            onClose={() => setRecordingPayment(false)}
            onRecorded={() => invoice.refetch()}
            invoice={invoice.data}
          />
          <CollectInvoiceCardPaymentDialog
            open={collectingCardPayment}
            onClose={() => setCollectingCardPayment(false)}
            onPaid={() => invoice.refetch()}
            invoice={invoice.data}
          />
          <VoidInvoiceDialog
            open={voiding}
            onClose={() => setVoiding(false)}
            onVoided={() => invoice.refetch()}
            invoice={invoice.data}
          />
        </>
      )}
    </Box>
  );
}
