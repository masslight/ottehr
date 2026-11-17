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
import { InvoiceStatusChip } from '../components/InvoiceStatusChip';
import { ReadOnlySection, thSx } from '../components/ReadOnlySection';
import { Row } from '../components/Row';
import { invoicePaymentMethodLabel } from '../constants/invoice';
import { useApiClients } from '../hooks/useAppClients';
import { downloadUrl } from '../utils/downloadFile';
import { formatDate } from '../utils/format';

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

function InvoiceSections({ invoice }: { invoice: BillingInvoiceDetail }): ReactElement {
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
        <Row label="Balance" value={invoice.balance !== undefined && formatCurrency(invoice.balance)} hideBorder />
      </ReadOnlySection>
      <ReadOnlySection title="Payments">
        {invoice.payments.length === 0
          ? 'No payments recorded.'
          : invoice.payments.map((payment, index) => (
              <Row
                key={payment.paymentNoticeId}
                label={formatDate(payment.paymentDate)}
                value={formatPaymentLine(payment)}
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

  const download = async (): Promise<void> => {
    if (!invoice.data?.pdfUrl) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      // The PDF link is presigned and expires, so get a fresh one just in case.
      const { data } = await invoice.refetch({
        throwOnError: true,
      });
      if (!data?.pdfUrl) throw new Error('This invoice has no PDF');
      await downloadUrl(`${data.number ?? data.id}.pdf`, data.pdfUrl);
    } catch (error) {
      setDownloadError(
        getApiError({
          error,
          defaultError: "The invoice PDF didn't download",
        })
      );
    } finally {
      setDownloading(false);
    }
  };

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
        <Button variant="contained" disabled>
          Record payment
        </Button>
        <Button variant="outlined" disabled>
          Collect card payment
        </Button>
        <Button
          startIcon={downloading ? <CircularProgress size={14} /> : <DownloadIcon />}
          disabled={!invoice.data?.pdfUrl || downloading}
          onClick={() => void download()}
        >
          Download invoice
        </Button>
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
        <InvoiceSections invoice={invoice.data} />
      )}
    </Box>
  );
}
