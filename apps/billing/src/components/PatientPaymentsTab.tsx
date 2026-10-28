import { Alert, Box, Link, Typography } from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import { DateTime } from 'luxon';
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

type PaymentRow = BillingPatientAccountPayment & { id: string };

// payment and visit times are instants, shown on the viewer's calendar day
const formatLocalDate = (iso: string | undefined): string => {
  if (!iso) return '';
  const date = DateTime.fromISO(iso);
  return date.isValid ? date.toFormat('MM/dd/yyyy') : iso;
};

function AmountCell({ payment }: { payment: BillingPatientAccountPayment }): ReactElement {
  const refundState = getRefundState(payment);
  const amount = formatCurrency(payment.amountInCents / 100);
  const netCents = payment.amountInCents - (payment.refundedAmountInCents ?? 0);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', py: 0.5 }}>
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
      <RefundChip state={refundState} />
    </Box>
  );
}

function MethodCell({ payment }: { payment: BillingPatientAccountPayment }): ReactElement {
  const label = METHOD_LABELS[payment.method];
  if (!payment.cardLast4) return <Typography variant="body2">{label}</Typography>;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <CreditCardBrandIcon brand={payment.cardBrand ?? ''} />
      <Typography variant="body2">•••• {payment.cardLast4}</Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

const columns: GridColDef<PaymentRow>[] = [
  {
    field: 'dateISO',
    headerName: 'Payment Date',
    width: 130,
    valueFormatter: (params: { value: string }) => formatLocalDate(params.value),
  },
  {
    field: 'amountInCents',
    headerName: 'Amount',
    flex: 1,
    minWidth: 280,
    renderCell: ({ row }) => <AmountCell payment={row} />,
  },
  {
    field: 'visitDateISO',
    headerName: 'Encounter',
    width: 130,
    renderCell: ({ row }) => {
      const visitDate = formatLocalDate(row.visitDateISO);
      if (!EHR_URL || !row.appointmentId) return visitDate;
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
    width: 130,
    renderCell: ({ row }) =>
      row.claimId ? (
        <Link component={RouterLink} to={`/claims/${row.claimId}`}>
          {row.claimServiceDate ? formatDate(row.claimServiceDate) : 'Open claim'}
        </Link>
      ) : null,
  },
  {
    field: 'method',
    headerName: 'Method',
    flex: 1,
    minWidth: 220,
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
        getRowHeight={() => 'auto'}
        disableRowSelectionOnClick
        disableColumnMenu
        autoHeight
        pageSizeOptions={[25, 50]}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        slots={dataGridSlots()}
        sx={{ ...dataGridSx, '& .MuiDataGrid-cell': { alignItems: 'center', display: 'flex' } }}
      />
    </Box>
  );
}
