import { Add as AddIcon } from '@mui/icons-material';
import { Alert, Box, Button, capitalize, Link, Tooltip, Typography } from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import { MouseEvent, ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { CreditCardBrandIcon } from 'ui-components/lib/components/CreditCardBrandIcon';
import { getRefundState, RefundChip } from 'ui-components/lib/components/PaymentRefundChip';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { paymentDayOf } from 'utils/lib/helpers/rcm/payment-day';
import {
  BillingPatientAccountPayment,
  BillingPatientPaymentMethod,
  BillingPatientVisit,
} from 'utils/lib/types/data/billing/billing.types';
import { formatCurrencyFromCents } from 'utils/lib/utils/convert';
import { listBillingPatientAccountPayments } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { formatDate } from '../utils/format';
import { AddPatientPaymentDialog } from './AddPatientPaymentDialog';
import { dataGridSlots, dataGridSx } from './BillingDataGrid';

export const EHR_URL = import.meta.env.VITE_APP_EHR_URL;

export const METHOD_LABELS: Record<BillingPatientPaymentMethod, string> = {
  card: 'Card',
  'card-reader': 'Card reader',
  'external-card-reader': 'External card reader',
  cash: 'Cash',
  check: 'Check',
  invoice: 'Invoice',
  other: 'Other',
};

const CARD_BRAND_NAMES: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
};

const PAGE_SIZE = 25;
const EMPTY_CELL = '—';

type PaymentRow = BillingPatientAccountPayment & { id: string };

// cash payments from legacy notices may carry no notice id
const paymentRowId = (payment: BillingPatientAccountPayment, idx: number): string =>
  payment.fhirPaymentNotificationId ?? `${payment.encounterId}-${idx}`;

// a payment without a notice id cannot be looked up on its own
export const paymentDetailPath = (patientId: string, payment: BillingPatientAccountPayment): string | undefined =>
  payment.fhirPaymentNotificationId
    ? `/patients/${patientId}/encounters/${encodeURIComponent(payment.encounterId)}/payments/${encodeURIComponent(
        payment.fhirPaymentNotificationId
      )}`
    : undefined;

export const paymentMethodLabel = (payment: BillingPatientAccountPayment): string => {
  const label = METHOD_LABELS[payment.method];
  if (!payment.cardLast4) return label;
  const brand = payment.cardBrand ? CARD_BRAND_NAMES[payment.cardBrand] ?? capitalize(payment.cardBrand) : 'Card';
  return `${label} — ${brand} •••• ${payment.cardLast4}`;
};

// links inside a row must not also open the payment the row links to
const stopRowClick = (e: MouseEvent): void => e.stopPropagation();

function AmountCell({ payment }: { payment: BillingPatientAccountPayment }): ReactElement {
  const refundState = getRefundState(payment);
  const amount = formatCurrencyFromCents(payment.amountInCents);
  const netCents = payment.amountInCents - (payment.refundedAmountInCents ?? 0);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, width: '100%' }}>
      <RefundChip state={refundState} />
      {refundState === 'none' ? (
        <Typography variant="body2">{amount}</Typography>
      ) : (
        <>
          <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.disabled' }}>
            {amount}
          </Typography>
          {refundState === 'partial' && <Typography variant="body2">{formatCurrencyFromCents(netCents)}</Typography>}
        </>
      )}
    </Box>
  );
}

function MethodCell({ payment }: { payment: BillingPatientAccountPayment }): ReactElement {
  if (!payment.cardLast4) return <Typography variant="body2">{METHOD_LABELS[payment.method]}</Typography>;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <CreditCardBrandIcon brand={payment.cardBrand ?? ''} />
      <Typography variant="body2" noWrap>
        {paymentMethodLabel(payment)}
      </Typography>
    </Box>
  );
}

const columns: GridColDef<PaymentRow>[] = [
  {
    field: 'dateISO',
    headerName: 'Payment Date',
    width: 150,
    valueFormatter: (params: { value: string }) => formatDate(paymentDayOf(params.value)),
    // Sort by the displayed practice-local day, not the raw ISO string: date-only manual payments and
    // UTC timestamps would otherwise interleave across day boundaries.
    sortComparator: (a: string, b: string) => paymentDayOf(a).localeCompare(paymentDayOf(b)),
  },
  {
    field: 'amountInCents',
    headerName: 'Amount',
    width: 320,
    align: 'right',
    headerAlign: 'right',
    renderCell: ({ row }) => <AmountCell payment={row} />,
  },
  {
    field: 'visitDateISO',
    headerName: 'Encounter',
    width: 150,
    renderCell: ({ row }) => {
      const visitDate = formatDate(row.visitDateISO);
      if (!EHR_URL || !row.appointmentId) return visitDate || EMPTY_CELL;
      return (
        <Link
          href={`${EHR_URL}/visit/${row.appointmentId}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={stopRowClick}
        >
          {visitDate || 'Open visit'}
        </Link>
      );
    },
  },
  {
    field: 'claimServiceDate',
    headerName: 'Claim',
    width: 150,
    renderCell: ({ row }) =>
      row.claimId ? (
        <Link component={RouterLink} to={`/claims/${row.claimId}`} onClick={stopRowClick}>
          {formatDate(row.claimServiceDate) || 'Open claim'}
        </Link>
      ) : (
        EMPTY_CELL
      ),
  },
  {
    field: 'method',
    headerName: 'Method',
    flex: 1,
    minWidth: 280,
    renderCell: ({ row }) => <MethodCell payment={row} />,
  },
];

export function PatientPaymentsTab({
  patientId,
  clinicalPatientId,
  onPaymentAdded,
}: {
  patientId: string;
  // absent for a patient created in billing alone, who has no visits to take payments for
  clinicalPatientId?: string;
  onPaymentAdded?: () => Promise<void> | void;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();
  const [payments, setPayments] = useState<BillingPatientAccountPayment[]>([]);
  const [visits, setVisits] = useState<BillingPatientVisit[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listBillingPatientAccountPayments(oystehrZambda, { patientId });
      setPayments(res.payments);
      setVisits(res.visits);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to load payments' }));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, patientId]);

  useEffect(() => {
    void fetchPayments();
  }, [fetchPayments]);

  const openPayment = (payment: BillingPatientAccountPayment): void => {
    const path = paymentDetailPath(patientId, payment);
    if (path) navigate(path);
  };

  const rows = useMemo<PaymentRow[]>(
    () => payments.map((payment, idx) => ({ ...payment, id: paymentRowId(payment, idx) })),
    [payments]
  );

  const handlePaymentAdded = useCallback(async (): Promise<void> => {
    await Promise.all([fetchPayments(), onPaymentAdded?.()]);
  }, [fetchPayments, onPaymentAdded]);

  const canAddPayment = Boolean(clinicalPatientId) && visits.length > 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
        <Tooltip title={!loading && !canAddPayment ? 'The patient has no visits to record a payment for' : ''}>
          <span>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddOpen(true)}
              disabled={loading || !canAddPayment}
            >
              Add Payment
            </Button>
          </span>
        </Tooltip>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <DataGridPro
        rows={rows}
        columns={columns}
        loading={loading}
        rowHeight={56}
        onRowClick={({ row }) => openPayment(row)}
        // keyboard parity with onRowClick: Enter/Space on a focused cell opens the payment
        onCellKeyDown={({ row }, event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          // keys pressed on the Encounter/Claim links inside a cell are the link's own
          if ((event.target as HTMLElement).closest('a')) return;
          event.preventDefault();
          openPayment(row);
        }}
        getRowClassName={({ row }) => (row.fhirPaymentNotificationId ? 'payment-row--linked' : '')}
        disableRowSelectionOnClick
        disableColumnMenu
        autoHeight
        hideFooter={rows.length <= PAGE_SIZE}
        pagination
        pageSizeOptions={[PAGE_SIZE, 50]}
        initialState={{ pagination: { paginationModel: { pageSize: PAGE_SIZE } } }}
        slots={dataGridSlots()}
        sx={{ ...dataGridSx, '& .payment-row--linked': { cursor: 'pointer' } }}
      />
      {clinicalPatientId && (
        <AddPatientPaymentDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onPaymentAdded={handlePaymentAdded}
          billingPatientId={patientId}
          clinicalPatientId={clinicalPatientId}
          visits={visits}
        />
      )}
    </Box>
  );
}
