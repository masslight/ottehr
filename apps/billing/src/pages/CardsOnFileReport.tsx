import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Link,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { ReactElement, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCardBrandIcon } from 'ui-components/lib/components/CreditCardBrandIcon';
import { CardOnFileReportRow, GetBillingCardsOnFileReportResponse } from 'utils/lib/types/data/billing/billing.types';
import { formatCurrency } from 'utils/lib/utils/convert';
import { getBillingCardsOnFileReport } from '../api/api';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { ReportStatusBar } from '../components/ReportStatusBar';
import { useBillingReport } from '../hooks/useBillingReport';
import { otherColors } from '../themes/ottehr/colors';

type CardFilter = 'all' | 'with-card' | 'without-card';

const dayLabel = (day: string): string => (day ? DateTime.fromISO(day).toLocaleString(DateTime.DATE_MED) : '—');

const capitalize = (value: string): string => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

// account-scoped dashboard path for connected accounts; /test for sandbox customers
const stripeCustomerUrl = (row: CardOnFileReportRow): string =>
  ['https://dashboard.stripe.com', row.stripeAccountId, row.livemode ? '' : 'test', 'customers', row.stripeCustomerId]
    .filter(Boolean)
    .join('/');

const columns: GridColDef[] = [
  {
    field: 'patientName',
    headerName: 'Patient',
    flex: 1,
    minWidth: 200,
    valueGetter: (params) => (params.row as CardOnFileReportRow).patientName || '—',
    renderCell: ({ row }) => {
      const cardRow = row as CardOnFileReportRow;
      if (!cardRow.patientName) return '—';
      if (!cardRow.patientId) return cardRow.patientName;
      return (
        <Link
          href={`${import.meta.env.VITE_APP_EHR_URL}/patient/${cardRow.patientId}`}
          target="_blank"
          rel="noopener"
          underline="hover"
          onClick={(e) => e.stopPropagation()}
          sx={{ fontWeight: 500 }}
        >
          {cardRow.patientName}
        </Link>
      );
    },
  },
  {
    field: 'customerName',
    headerName: 'Stripe Customer',
    flex: 1,
    minWidth: 220,
    valueGetter: (params) => {
      const row = params.row as CardOnFileReportRow;
      return row.customerName || row.stripeCustomerId;
    },
    renderCell: ({ row }) => {
      const cardRow = row as CardOnFileReportRow;
      return (
        <Stack direction="row" alignItems="baseline" spacing={1} sx={{ minWidth: 0 }}>
          <Link
            href={stripeCustomerUrl(cardRow)}
            target="_blank"
            rel="noopener"
            underline="hover"
            onClick={(e) => e.stopPropagation()}
            sx={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {cardRow.customerName || cardRow.stripeCustomerId}
          </Link>
          {cardRow.customerName && (
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {cardRow.stripeCustomerId}
            </Typography>
          )}
        </Stack>
      );
    },
  },
  {
    field: 'cardId',
    headerName: 'Card on File',
    flex: 1,
    minWidth: 240,
    sortable: false,
    renderCell: ({ row }) => {
      const cardRow = row as CardOnFileReportRow;
      if (!cardRow.cardId) {
        return <Chip size="small" variant="outlined" label="No card on file" sx={{ height: 20, fontSize: 12 }} />;
      }
      const formattedBrand = cardRow.cardBrand ? capitalize(cardRow.cardBrand) : 'Card';
      return (
        <Stack direction="row" alignItems="center" spacing={1}>
          {cardRow.cardBrand && (
            <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
              <CreditCardBrandIcon brand={cardRow.cardBrand} />
            </Box>
          )}
          <Typography variant="body2">{`${formattedBrand} •••• ${cardRow.cardLast4 || '????'}`}</Typography>
        </Stack>
      );
    },
  },
  {
    field: 'openInvoiceAmount',
    headerName: 'Invoices Due',
    width: 170,
    valueGetter: (params) => (params.row as CardOnFileReportRow).openInvoiceAmount ?? 0,
    renderCell: ({ row }) => {
      const cardRow = row as CardOnFileReportRow;
      if (!cardRow.openInvoiceCount) return '—';
      return (
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="body2">{formatCurrency(cardRow.openInvoiceAmount)}</Typography>
          <Chip
            size="small"
            color={cardRow.hasPastDueInvoice ? 'error' : 'warning'}
            variant="outlined"
            label={cardRow.hasPastDueInvoice ? 'Past due' : 'Due'}
            sx={{ height: 20, fontSize: 12 }}
          />
        </Stack>
      );
    },
  },
  {
    field: 'lastVisitDate',
    headerName: 'Last Visit',
    width: 150,
    renderCell: ({ row }) => {
      const cardRow = row as CardOnFileReportRow;
      if (!cardRow.lastVisitDate) return '—';
      const label = dayLabel(cardRow.lastVisitDate.slice(0, 10));
      if (!cardRow.lastVisitAppointmentId) return label;
      return (
        <Link
          href={`${import.meta.env.VITE_APP_EHR_URL}/visit/${cardRow.lastVisitAppointmentId}`}
          target="_blank"
          rel="noopener"
          underline="hover"
          onClick={(e) => e.stopPropagation()}
        >
          {label}
        </Link>
      );
    },
  },
];

function StatCard({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 160,
        bgcolor: 'background.paper',
        border: `1px solid ${otherColors.lightDivider}`,
        borderRadius: 2,
        px: 2.5,
        py: 2,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </Typography>
      <Typography variant="h5" color="primary.dark" fontWeight={600} sx={{ mt: 0.5 }}>
        {value}
      </Typography>
    </Box>
  );
}

export default function CardsOnFileReport(): ReactElement {
  const navigate = useNavigate();

  const [cardFilter, setCardFilter] = useState<CardFilter>('all');
  const [dueInvoicesOnly, setDueInvoicesOnly] = useState(true);

  const { report, status, loading, error, clearError, refresh } = useBillingReport<GetBillingCardsOnFileReportResponse>(
    {
      fetch: useCallback(
        (client: Oystehr, refresh?: boolean) => getBillingCardsOnFileReport(client, undefined, refresh),
        []
      ),
      errorMessage: 'Failed to load cards on file report',
    }
  );

  const filteredRows = useMemo(() => {
    let rows = report?.rows ?? [];
    if (dueInvoicesOnly) rows = rows.filter((row) => (row.openInvoiceCount ?? 0) > 0);
    if (cardFilter === 'with-card') return rows.filter((row) => row.cardId);
    if (cardFilter === 'without-card') return rows.filter((row) => !row.cardId);
    return rows;
  }, [report, cardFilter, dueInvoicesOnly]);

  // aggregates follow the due-invoices toggle (but not the card filter, which splits the same population)
  const stats = useMemo(() => {
    let rows = report?.rows ?? [];
    if (dueInvoicesOnly) rows = rows.filter((row) => (row.openInvoiceCount ?? 0) > 0);
    const withCard = rows.filter((row) => row.cardId).length;
    const withOpenInvoices = rows.filter((row) => (row.openInvoiceCount ?? 0) > 0).length;
    return { customers: rows.length, withCard, withoutCard: rows.length - withCard, withOpenInvoices };
  }, [report, dueInvoicesOnly]);

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/reports')}
        sx={{ mb: 1.5, color: 'text.secondary', textTransform: 'none' }}
      >
        Reports
      </Button>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1.5} mb={3}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" color="primary.dark" fontWeight={600}>
            Credit Cards on File
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            All Stripe customers matched to Oystehr patients, with card-on-file status and last visit.
          </Typography>
        </Box>
        <ReportStatusBar status={status} loading={loading} onRefresh={refresh} />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>
          {error}
        </Alert>
      )}

      {report?.truncated && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Showing the first {report.totals.customers.toLocaleString()} Stripe customers — the full customer list is
          larger.
        </Alert>
      )}

      {(report?.pendingCardLookups ?? 0) > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Resolving card status — {(report?.pendingCardLookups ?? 0).toLocaleString()} customers remaining
          {status?.state === 'running' ? '…' : '. Refresh to continue.'}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} gap={2} mb={2.5}>
        <StatCard label="Customers" value={stats.customers.toLocaleString('en-US')} />
        <StatCard label="Card on File" value={stats.withCard.toLocaleString('en-US')} />
        <StatCard label="No Card on File" value={stats.withoutCard.toLocaleString('en-US')} />
        <StatCard label="Due / Past-Due Invoices" value={stats.withOpenInvoices.toLocaleString('en-US')} />
      </Stack>

      <Stack direction="row" alignItems="center" gap={1} mb={2} flexWrap="wrap">
        <Typography variant="body2" color="text.secondary">
          Show:
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={cardFilter}
          onChange={(_e, value: CardFilter | null) => value && setCardFilter(value)}
        >
          <ToggleButton value="all" sx={{ px: 1.5, py: 0.5, textTransform: 'none' }}>
            All
          </ToggleButton>
          <ToggleButton value="with-card" sx={{ px: 1.5, py: 0.5, textTransform: 'none' }}>
            Card on file
          </ToggleButton>
          <ToggleButton value="without-card" sx={{ px: 1.5, py: 0.5, textTransform: 'none' }}>
            No card on file
          </ToggleButton>
        </ToggleButtonGroup>
        <FormControlLabel
          sx={{ ml: 1 }}
          control={
            <Switch size="small" checked={dueInvoicesOnly} onChange={(_e, checked) => setDueInvoicesOnly(checked)} />
          }
          label={
            <Typography variant="body2" color="text.secondary">
              Due / past-due invoices only
            </Typography>
          }
        />
      </Stack>

      <DataGridPro
        // remount on filter change so pagination resets to the first page
        key={`${cardFilter}|${dueInvoicesOnly}`}
        autoHeight
        rows={filteredRows}
        getRowId={(row) => `${row.stripeAccountId}|${row.stripeCustomerId}`}
        columns={columns}
        loading={loading}
        disableRowSelectionOnClick
        disableColumnMenu
        pagination
        initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
        pageSizeOptions={[25, 50, 100]}
        sx={dataGridSx}
        slots={dataGridSlots()}
      />
    </Box>
  );
}
