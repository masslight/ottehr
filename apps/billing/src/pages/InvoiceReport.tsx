import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  Link,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { ReactElement, useCallback, useMemo, useState } from 'react';
import { Chart } from 'react-google-charts';
import { useNavigate } from 'react-router-dom';
import {
  GetBillingInvoiceReportResponse,
  InvoiceReportCategory,
  InvoiceReportRow,
} from 'utils/lib/types/data/billing/billing.types';
import { formatCurrency } from 'utils/lib/utils/convert';
import { getBillingInvoiceReport } from '../api/api';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { ReportStatusBar } from '../components/ReportStatusBar';
import { useBillingReport } from '../hooks/useBillingReport';
import { otherColors } from '../themes/ottehr/colors';
import { reportPalette } from '../themes/ottehr/reportPalette';

type CategoryFilter = InvoiceReportCategory | 'all';

const CATEGORY_META: Record<InvoiceReportCategory, { label: string; color: string }> = {
  upcoming: { label: 'Coming Due', color: reportPalette.invoiceCategory.upcoming },
  'past-due-no-card': { label: 'Past Due: No Card on File', color: reportPalette.invoiceCategory['past-due-no-card'] },
  'past-due-not-attempted': {
    label: 'Past Due: Charge Not Attempted',
    color: reportPalette.invoiceCategory['past-due-not-attempted'],
  },
  'past-due-failed': { label: 'Past Due: Charge Failed', color: reportPalette.invoiceCategory['past-due-failed'] },
};
const CATEGORY_ORDER: InvoiceReportCategory[] = [
  'upcoming',
  'past-due-no-card',
  'past-due-not-attempted',
  'past-due-failed',
];

interface AgingBucket {
  key: string;
  label: string;
  minDays: number;
  maxDays: number;
  color: string;
}

const AGING_BUCKETS: AgingBucket[] = [
  { key: '0-30', label: '0–30 days', minDays: 0, maxDays: 30, color: reportPalette.agingBuckets[0] },
  { key: '30-60', label: '30–60 days', minDays: 30, maxDays: 60, color: reportPalette.agingBuckets[1] },
  { key: '60-90', label: '60–90 days', minDays: 60, maxDays: 90, color: reportPalette.agingBuckets[2] },
  { key: '90-120', label: '90–120 days', minDays: 90, maxDays: 120, color: reportPalette.agingBuckets[3] },
  { key: '120-150', label: '120–150 days', minDays: 120, maxDays: 150, color: reportPalette.agingBuckets[4] },
  { key: '150+', label: '150+ days', minDays: 150, maxDays: Infinity, color: reportPalette.agingBuckets[5] },
];

type AgingFilter = string | 'all';

// the backend-computed anchor keeps grid buckets consistent with the aging trend
const daysPastDue = (row: InvoiceReportRow): number => {
  const anchorISO = row.agingAnchorDate || row.dueDate;
  if (!anchorISO) return 0;
  const anchor = DateTime.fromISO(anchorISO);
  if (!anchor.isValid) return 0;
  return Math.max(0, Math.floor(DateTime.now().diff(anchor, 'days').days));
};

const bucketOf = (days: number): AgingBucket =>
  AGING_BUCKETS.find((bucket) => days >= bucket.minDays && days < bucket.maxDays) ?? AGING_BUCKETS[0];

const dayLabel = (iso: string): string => (iso ? DateTime.fromISO(iso).toLocaleString(DateTime.DATE_MED) : '—');

// account-scoped dashboard path for connected accounts; /test for sandbox invoices
const stripeInvoiceUrl = (row: InvoiceReportRow): string =>
  ['https://dashboard.stripe.com', row.stripeAccountId, row.livemode ? '' : 'test', 'invoices', row.stripeInvoiceId]
    .filter(Boolean)
    .join('/');

const columns: GridColDef[] = [
  {
    field: 'patientName',
    headerName: 'Patient',
    flex: 1,
    minWidth: 200,
    valueGetter: (params) => {
      const row = params.row as InvoiceReportRow;
      return row.patientName || row.customerName || '—';
    },
    renderCell: ({ row }) => {
      const invoiceRow = row as InvoiceReportRow;
      const name = invoiceRow.patientName || invoiceRow.customerName;
      if (!name) return '—';
      if (!invoiceRow.patientId) return name;
      return (
        <Link
          href={`${import.meta.env.VITE_APP_EHR_URL}/patient/${invoiceRow.patientId}`}
          target="_blank"
          rel="noopener"
          underline="hover"
          sx={{ fontWeight: 500 }}
        >
          {name}
        </Link>
      );
    },
  },
  {
    field: 'invoiceNumber',
    headerName: 'Invoice',
    width: 170,
    renderCell: ({ row }) => {
      const invoiceRow = row as InvoiceReportRow;
      const label = invoiceRow.invoiceNumber || invoiceRow.stripeInvoiceId;
      return (
        <Link href={stripeInvoiceUrl(invoiceRow)} target="_blank" rel="noopener" underline="hover">
          {label}
        </Link>
      );
    },
  },
  {
    field: 'category',
    headerName: 'Status',
    width: 230,
    renderCell: ({ row }) => {
      const invoiceRow = row as InvoiceReportRow;
      const meta = CATEGORY_META[invoiceRow.category];
      return (
        <Chip
          size="small"
          variant="outlined"
          label={meta.label}
          sx={{ height: 20, fontSize: 12, color: meta.color, borderColor: meta.color }}
        />
      );
    },
  },
  {
    field: 'amountDue',
    headerName: 'Amount Due',
    width: 130,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: ({ value }) => formatCurrency(value as number),
  },
  {
    field: 'visitDate',
    headerName: 'Visit',
    width: 120,
    renderCell: ({ row }) => {
      const invoiceRow = row as InvoiceReportRow;
      if (!invoiceRow.visitDate) return '—';
      const label = dayLabel(invoiceRow.visitDate);
      if (!invoiceRow.appointmentId) return label;
      return (
        <Link
          href={`${import.meta.env.VITE_APP_EHR_URL}/visit/${invoiceRow.appointmentId}`}
          target="_blank"
          rel="noopener"
          underline="hover"
        >
          {label}
        </Link>
      );
    },
  },
  {
    field: 'createdDate',
    headerName: 'Issued',
    width: 120,
    valueFormatter: ({ value }) => dayLabel(value as string),
  },
  {
    field: 'dueDate',
    headerName: 'Due',
    width: 120,
    valueFormatter: ({ value }) => dayLabel(value as string),
  },
  {
    field: 'lastPaymentError',
    headerName: 'Last Payment Error',
    flex: 1,
    minWidth: 200,
    valueGetter: (params) => (params.row as InvoiceReportRow).lastPaymentError || '—',
  },
];

// same grid, but the delinquency category column swapped for age bucket + days past due (no payment error)
const agingColumns: GridColDef[] = [
  ...columns.filter((column) => column.field !== 'category' && column.field !== 'lastPaymentError'),
];
agingColumns.splice(2, 0, {
  field: 'agingBucket',
  headerName: 'Age',
  width: 130,
  renderCell: ({ row }) => {
    const bucket = AGING_BUCKETS.find((candidate) => candidate.key === row.agingBucket);
    if (!bucket) return '—';
    return (
      <Chip
        size="small"
        variant="outlined"
        label={bucket.label}
        sx={{ height: 20, fontSize: 12, color: bucket.color, borderColor: bucket.color }}
      />
    );
  },
});
agingColumns.splice(3, 0, {
  field: 'daysPastDue',
  headerName: 'Days Past Due',
  width: 130,
  align: 'right',
  headerAlign: 'right',
});

function StatCard({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: string;
}): ReactElement {
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
      <Typography variant="h5" fontWeight={600} sx={{ mt: 0.5, color: color ?? 'primary.dark' }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Box>
  );
}

export default function InvoiceReport(): ReactElement {
  const navigate = useNavigate();

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [agingFilter, setAgingFilter] = useState<AgingFilter>('all');
  const [tab, setTab] = useState<'delinquency' | 'aging'>('delinquency');

  const { report, status, loading, error, clearError, refresh } = useBillingReport<GetBillingInvoiceReportResponse>({
    fetch: useCallback((client: Oystehr, refresh?: boolean) => getBillingInvoiceReport(client, undefined, refresh), []),
    errorMessage: 'Failed to load invoice report',
  });

  const filteredRows = useMemo(() => {
    const rows = report?.rows ?? [];
    if (categoryFilter === 'all') return rows;
    return rows.filter((row) => row.category === categoryFilter);
  }, [report, categoryFilter]);

  const pieData = useMemo(() => {
    const totalCount = CATEGORY_ORDER.reduce((sum, category) => sum + (report?.totals[category]?.count ?? 0), 0);
    return [
      ['Category', 'Invoices', { role: 'tooltip' }],
      ...CATEGORY_ORDER.map((category) => {
        const count = report?.totals[category]?.count ?? 0;
        const pct = totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : '0.0';
        return [
          CATEGORY_META[category].label,
          count,
          `${CATEGORY_META[category].label}\n${count.toLocaleString('en-US')} invoices (${pct}%)\n${formatCurrency(
            report?.totals[category]?.amountDue ?? 0
          )}`,
        ];
      }),
    ];
  }, [report]);

  // aging: past-due invoices only, bucketed by days past due
  const agingRows = useMemo(
    () =>
      (report?.rows ?? [])
        .filter((row) => row.category !== 'upcoming')
        .map((row) => {
          const days = daysPastDue(row);
          return { ...row, daysPastDue: days, agingBucket: bucketOf(days).key };
        }),
    [report]
  );

  const agingTotals = useMemo(() => {
    const totals = new Map(AGING_BUCKETS.map((bucket) => [bucket.key, { count: 0, amountDue: 0 }]));
    for (const row of agingRows) {
      const total = totals.get(row.agingBucket);
      if (total) {
        total.count += 1;
        total.amountDue += row.amountDue;
      }
    }
    return totals;
  }, [agingRows]);

  const agingPieData = useMemo(() => {
    const totalCount = agingRows.length;
    const totalAmount = agingRows.reduce((sum, row) => sum + row.amountDue, 0);
    const tooltipFor = (bucket: AgingBucket): string => {
      const total = agingTotals.get(bucket.key) ?? { count: 0, amountDue: 0 };
      const countPct = totalCount > 0 ? ((total.count / totalCount) * 100).toFixed(1) : '0.0';
      const amountPct = totalAmount > 0 ? ((total.amountDue / totalAmount) * 100).toFixed(1) : '0.0';
      return `${bucket.label}\n${total.count.toLocaleString('en-US')} invoices (${countPct}%)\n${formatCurrency(
        total.amountDue
      )} (${amountPct}%)`;
    };
    return {
      byAmount: [
        ['Bucket', 'Amount', { role: 'tooltip' }],
        ...AGING_BUCKETS.map((bucket) => [
          bucket.label,
          agingTotals.get(bucket.key)?.amountDue ?? 0,
          tooltipFor(bucket),
        ]),
      ],
      byCount: [
        ['Bucket', 'Invoices', { role: 'tooltip' }],
        ...AGING_BUCKETS.map((bucket) => [bucket.label, agingTotals.get(bucket.key)?.count ?? 0, tooltipFor(bucket)]),
      ],
    };
  }, [agingRows, agingTotals]);

  const filteredAgingRows = useMemo(
    () => (agingFilter === 'all' ? agingRows : agingRows.filter((row) => row.agingBucket === agingFilter)),
    [agingRows, agingFilter]
  );

  // month-end snapshots computed server-side from all Stripe invoices (incl. since-paid) via status_transitions
  const agingTrendData = useMemo(() => {
    const header = ['Month', 'Not yet due', ...AGING_BUCKETS.map((bucket) => bucket.label)];
    const rows = (report?.agingTrend ?? []).map((point) => [
      point.label,
      point.buckets['not-yet-due']?.count ?? 0,
      ...AGING_BUCKETS.map((bucket) => point.buckets[bucket.key]?.count ?? 0),
    ]);
    return [header, ...rows];
  }, [report]);

  const agingChartOptions = {
    is3D: true,
    colors: AGING_BUCKETS.map((bucket) => bucket.color),
    backgroundColor: 'transparent',
    legend: { position: 'left' as const, textStyle: { fontSize: 12 } },
    chartArea: { width: '95%', height: '85%' },
    pieSliceTextStyle: { bold: true, fontSize: 13 },
    slices: Object.fromEntries(AGING_BUCKETS.map((_bucket, index) => [index, { offset: 0.05 }])),
  };

  const agingChartEvents = [
    {
      eventName: 'select' as const,
      callback: ({
        chartWrapper,
      }: {
        chartWrapper: { getChart: () => { getSelection: () => { row?: number }[] } } | null;
      }) => {
        const row = chartWrapper?.getChart()?.getSelection()?.[0]?.row;
        // clicking a selected slice deselects, clearing the filter
        setAgingFilter(row == null ? 'all' : AGING_BUCKETS[row]?.key ?? 'all');
      },
    },
  ];

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
            Invoice Report
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            All due and past-due Stripe invoices, broken down by collectability.
          </Typography>
        </Box>
        <ReportStatusBar status={status} loading={loading} onRefresh={refresh} />
      </Stack>

      <Tabs
        value={tab}
        onChange={(_e, value) => setTab(value)}
        sx={{ mb: 2.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="delinquency" label="Delinquency" sx={{ textTransform: 'none' }} />
        <Tab value="aging" label="Aging Receivables" sx={{ textTransform: 'none' }} />
      </Tabs>

      {tab === 'aging' && (
        <>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>
              {error}
            </Alert>
          )}

          <Stack direction={{ xs: 'column', lg: 'row' }} gap={2} mb={2.5}>
            {(
              [
                { title: 'Past-Due Amount by Age', data: agingPieData.byAmount },
                { title: 'Past-Due Invoice Count by Age', data: agingPieData.byCount },
              ] as const
            ).map(({ title, data }) => (
              <Box
                key={title}
                sx={{
                  flex: 1,
                  bgcolor: 'background.paper',
                  border: `1px solid ${otherColors.lightDivider}`,
                  borderRadius: 2,
                  p: 1.5,
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ textTransform: 'uppercase', letterSpacing: 0.4, pl: 1 }}
                >
                  {title}
                </Typography>
                <Chart
                  chartType="PieChart"
                  width="100%"
                  height="280px"
                  data={data}
                  options={agingChartOptions}
                  chartEvents={agingChartEvents}
                />
              </Box>
            ))}
          </Stack>

          <Box
            sx={{
              bgcolor: 'background.paper',
              border: `1px solid ${otherColors.lightDivider}`,
              borderRadius: 2,
              p: 1.5,
              mb: 2.5,
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textTransform: 'uppercase', letterSpacing: 0.4, pl: 1 }}
            >
              Aging Trend — Month-End Snapshots
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pl: 1 }}>
              Reconstructed from all Stripe invoices via status history — invoices paid since are counted in the months
              they were open.
            </Typography>
            <Chart
              chartType="ColumnChart"
              width="100%"
              height="320px"
              data={agingTrendData}
              options={{
                isStacked: true,
                colors: [reportPalette.agingNotYetDue, ...AGING_BUCKETS.map((bucket) => bucket.color)],
                backgroundColor: 'transparent',
                legend: { position: 'right', textStyle: { fontSize: 12 } },
                chartArea: { width: '78%', height: '75%' },
                vAxis: { format: '#,###', minValue: 0 },
              }}
            />
          </Box>

          <Stack direction={{ xs: 'column', md: 'row' }} gap={2} mb={2.5}>
            <StatCard
              label="Total Unpaid"
              value={formatCurrency(agingRows.reduce((sum, row) => sum + row.amountDue, 0))}
              hint={`${agingRows.length.toLocaleString('en-US')} invoices`}
            />
            {AGING_BUCKETS.map((bucket) => (
              <StatCard
                key={bucket.key}
                label={bucket.label}
                value={formatCurrency(agingTotals.get(bucket.key)?.amountDue ?? 0)}
                hint={`${(agingTotals.get(bucket.key)?.count ?? 0).toLocaleString('en-US')} invoices`}
                color={bucket.color}
              />
            ))}
          </Stack>

          <Stack direction="row" alignItems="center" gap={1} mb={2} flexWrap="wrap">
            <Typography variant="body2" color="text.secondary">
              Show:
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={agingFilter}
              onChange={(_e, value: AgingFilter | null) => value && setAgingFilter(value)}
            >
              <ToggleButton value="all" sx={{ px: 1.5, py: 0.5, textTransform: 'none' }}>
                All
              </ToggleButton>
              {AGING_BUCKETS.map((bucket) => (
                <ToggleButton key={bucket.key} value={bucket.key} sx={{ px: 1.5, py: 0.5, textTransform: 'none' }}>
                  {bucket.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>

          <DataGridPro
            // remount on filter change so pagination resets to the first page
            key={agingFilter}
            autoHeight
            rows={filteredAgingRows}
            getRowId={(row) => `${row.stripeAccountId}|${row.stripeInvoiceId}`}
            columns={agingColumns}
            loading={loading}
            disableRowSelectionOnClick
            disableColumnMenu
            pagination
            initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
            pageSizeOptions={[25, 50, 100]}
            sx={dataGridSx}
            slots={dataGridSlots()}
          />
        </>
      )}

      {tab === 'delinquency' && (
        <>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>
              {error}
            </Alert>
          )}

          <Stack direction={{ xs: 'column', md: 'row' }} gap={2} mb={2.5} alignItems="stretch">
            <Box
              sx={{
                bgcolor: 'background.paper',
                border: `1px solid ${otherColors.lightDivider}`,
                borderRadius: 2,
                p: 1.5,
                width: { xs: '100%', md: 480 },
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Chart
                chartType="PieChart"
                width="100%"
                height="280px"
                data={pieData}
                options={{
                  is3D: true,
                  colors: CATEGORY_ORDER.map((category) => CATEGORY_META[category].color),
                  backgroundColor: 'transparent',
                  legend: { position: 'left', textStyle: { fontSize: 12 } },
                  chartArea: { width: '95%', height: '85%' },
                  pieSliceTextStyle: { bold: true, fontSize: 13 },
                  // every slice pushed slightly off-center
                  slices: { 0: { offset: 0.05 }, 1: { offset: 0.05 }, 2: { offset: 0.05 } },
                }}
                chartEvents={[
                  {
                    eventName: 'select',
                    callback: ({ chartWrapper }) => {
                      const row = chartWrapper?.getChart()?.getSelection()?.[0]?.row;
                      // clicking a selected slice deselects, clearing the filter
                      setCategoryFilter(row == null ? 'all' : CATEGORY_ORDER[row] ?? 'all');
                    },
                  },
                ]}
              />
            </Box>
            <Stack gap={2} flex={1}>
              {CATEGORY_ORDER.map((category) => (
                <StatCard
                  key={category}
                  label={CATEGORY_META[category].label}
                  value={formatCurrency(report?.totals[category]?.amountDue ?? 0)}
                  hint={`${(report?.totals[category]?.count ?? 0).toLocaleString('en-US')} invoices`}
                  color={CATEGORY_META[category].color}
                />
              ))}
            </Stack>
          </Stack>

          <Stack direction="row" alignItems="center" gap={1} mb={2} flexWrap="wrap">
            <Typography variant="body2" color="text.secondary">
              Show:
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={categoryFilter}
              onChange={(_e, value: CategoryFilter | null) => value && setCategoryFilter(value)}
            >
              <ToggleButton value="all" sx={{ px: 1.5, py: 0.5, textTransform: 'none' }}>
                All
              </ToggleButton>
              {CATEGORY_ORDER.map((category) => (
                <ToggleButton key={category} value={category} sx={{ px: 1.5, py: 0.5, textTransform: 'none' }}>
                  {CATEGORY_META[category].label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>

          <DataGridPro
            // remount on filter change so pagination resets to the first page
            key={categoryFilter}
            autoHeight
            rows={filteredRows}
            getRowId={(row) => `${row.stripeAccountId}|${row.stripeInvoiceId}`}
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
        </>
      )}
    </Box>
  );
}
