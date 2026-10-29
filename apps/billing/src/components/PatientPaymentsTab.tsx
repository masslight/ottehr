import { Alert, Box, capitalize, Link, Typography } from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { CreditCardBrandIcon } from 'ui-components/lib/components/CreditCardBrandIcon';
import { getRefundState, RefundChip } from 'ui-components/lib/components/PaymentRefundChip';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { BillingPatientAccountPayment, BillingPatientPaymentMethod } from 'utils/lib/types/data/billing/billing.types';
import { formatCurrency } from 'utils/lib/utils/convert';
import { listBillingPatientAccountPayments } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { formatDate } from '../utils/format';
import { dataGridSlots, dataGridSx } from './BillingDataGrid';

const EHR_URL = import.meta.env.VITE_APP_EHR_URL;

const METHOD_LABELS: Record<BillingPatientPaymentMethod, string> = {
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
  unionpay: 'UnionPay',
  jcb: 'JCB',
  diners: 'Diners Club',
};

const PAGE_SIZE = 25;
const EMPTY_CELL = '—';

type PaymentRow = BillingPatientAccountPayment & { id: string };

function AmountCell({ payment }: { payment: BillingPatientAccountPayment }): ReactElement {
  const refundState = getRefundState(payment);
  const amount = formatCurrency(payment.amountInCents / 100);
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
          {refundState === 'partial' && <Typography variant="body2">{formatCurrency(netCents / 100)}</Typography>}
        </>
      )}
    </Box>
  );
}

function MethodCell({ payment }: { payment: BillingPatientAccountPayment }): ReactElement {
  const label = METHOD_LABELS[payment.method];
  if (!payment.cardLast4) return <Typography variant="body2">{label}</Typography>;
  const brand = payment.cardBrand ? CARD_BRAND_NAMES[payment.cardBrand] ?? capitalize(payment.cardBrand) : 'Card';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <CreditCardBrandIcon brand={payment.cardBrand ?? ''} />
      <Typography variant="body2" noWrap>
        {label} — {brand} •••• {payment.cardLast4}
      </Typography>
    </Box>
  );
}

const columns: GridColDef<PaymentRow>[] = [
  {
    field: 'dateISO',
    headerName: 'Payment Date',
    width: 150,
    valueFormatter: (params: { value: string }) => formatDate(params.value),
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
        <Link href={`${EHR_URL}/visit/${row.appointmentId}`} target="_blank" rel="noopener noreferrer">
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
        <Link component={RouterLink} to={`/claims/${row.claimId}`}>
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

export function PatientPaymentsTab({ patientId }: { patientId: string }): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [payments, setPayments] = useState<BillingPatientAccountPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listBillingPatientAccountPayments(oystehrZambda, { patientId });
      setPayments(res.payments);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to load payments' }));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, patientId]);

  useEffect(() => {
    void fetchPayments();
  }, [fetchPayments]);

  // cash payments from legacy notices may carry no notice id
  const rows = useMemo<PaymentRow[]>(
    () =>
      payments.map((payment, idx) => ({
        ...payment,
        id: payment.fhirPaymentNotificationId ?? `${payment.encounterId}-${idx}`,
      })),
    [payments]
  );

  return (
    <Box>
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
        disableRowSelectionOnClick
        disableColumnMenu
        autoHeight
        hideFooter={rows.length <= PAGE_SIZE}
        pageSizeOptions={[PAGE_SIZE, 50]}
        initialState={{ pagination: { paginationModel: { pageSize: PAGE_SIZE } } }}
        slots={dataGridSlots()}
        sx={{ ...dataGridSx, '& .MuiDataGrid-cell': { alignItems: 'center', display: 'flex' } }}
      />
    </Box>
  );
}
