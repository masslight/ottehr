import { Refresh as RefreshIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import { DateTime } from 'luxon';
import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import {
  GetBillingPaymentsReportResponse,
  PaymentsReportPayerRow,
  PaymentsReportWaterfallCell,
} from 'utils/lib/types/data/billing/billing.types';
import { formatCurrency } from 'utils/lib/utils/convert';
import { getBillingPaymentsReport } from '../api/api';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { DateRangeInput } from '../components/DateInput';
import { useApiClients } from '../hooks/useAppClients';
import { otherColors } from '../themes/ottehr/colors';

type AvgRateBasis = 'allowed' | 'insurancePaid';

type DateRangePreset =
  | 'previous-month'
  | 'current-month'
  | 'previous-quarter'
  | 'this-quarter'
  | 'year-to-date'
  | 'trailing-12-months'
  | 'custom';

const DATE_RANGE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'previous-month', label: 'Previous Month' },
  { value: 'current-month', label: 'Current Month' },
  { value: 'previous-quarter', label: 'Previous Quarter' },
  { value: 'this-quarter', label: 'This Quarter' },
  { value: 'year-to-date', label: 'Year-to-Date' },
  { value: 'trailing-12-months', label: 'Trailing 12 Months' },
  { value: 'custom', label: 'Custom Range' },
];

const presetRange = (preset: DateRangePreset): { from: string; to: string } => {
  const now = DateTime.now();
  switch (preset) {
    case 'previous-month': {
      const month = now.minus({ months: 1 });
      return { from: month.startOf('month').toISODate() ?? '', to: month.endOf('month').toISODate() ?? '' };
    }
    case 'current-month':
      return { from: now.startOf('month').toISODate() ?? '', to: now.toISODate() ?? '' };
    case 'previous-quarter': {
      const quarter = now.minus({ quarters: 1 });
      return { from: quarter.startOf('quarter').toISODate() ?? '', to: quarter.endOf('quarter').toISODate() ?? '' };
    }
    case 'this-quarter':
      return { from: now.startOf('quarter').toISODate() ?? '', to: now.toISODate() ?? '' };
    case 'year-to-date':
      return { from: now.startOf('year').toISODate() ?? '', to: now.toISODate() ?? '' };
    case 'trailing-12-months':
      return { from: now.minus({ months: 12 }).toISODate() ?? '', to: now.toISODate() ?? '' };
    case 'custom':
      return { from: '', to: '' };
  }
};

const DEFAULT_PRESET: DateRangePreset = 'current-month';

const currencyCol = (field: string, headerName: string, width = 130): GridColDef => ({
  field,
  headerName,
  width,
  align: 'right',
  headerAlign: 'right',
  valueFormatter: (params: { value: number }) => formatCurrency(params.value),
});

const buildColumns = (avgBasis: AvgRateBasis): GridColDef[] => [
  { field: 'payerName', headerName: 'Payer', flex: 1, minWidth: 220 },
  { field: 'payerId', headerName: 'Payer ID', width: 110 },
  { field: 'eraCount', headerName: 'ERAs', width: 80, align: 'right', headerAlign: 'right' },
  { field: 'claimCount', headerName: 'Claims', width: 90, align: 'right', headerAlign: 'right' },
  currencyCol('billed', 'Billed'),
  currencyCol('allowed', 'Allowed'),
  currencyCol('insurancePaid', 'Insurance Paid', 140),
  {
    ...currencyCol('avgPerClaim', `Avg / Claim (${avgBasis === 'allowed' ? 'Allowed' : 'Paid'})`, 170),
    valueGetter: (params) => {
      const row = params.row as PaymentsReportPayerRow;
      return row.claimCount > 0 ? row[avgBasis] / row.claimCount : 0;
    },
  },
  currencyCol('checkTotal', 'Check Total', 130),
];

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }): ReactElement {
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
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Box>
  );
}

const monthLabel = (month: string): string =>
  month === 'unknown' ? 'Unknown' : DateTime.fromISO(`${month}-01`).toFormat('MMMM yyyy');

// DOS × check-month matrix (lag triangle): rows are service months, columns are check months,
// cells are insurance dollars paid — always spanning all ERAs, independent of the range filter.
function WaterfallMatrix({ cells }: { cells: PaymentsReportWaterfallCell[] }): ReactElement {
  const serviceMonths = [...new Set(cells.map((c) => c.serviceMonth))].sort((a, b) =>
    a === 'unknown' ? 1 : b === 'unknown' ? -1 : a.localeCompare(b)
  );
  const checkMonths = [...new Set(cells.map((c) => c.checkMonth))].sort((a, b) =>
    a === 'unknown' ? 1 : b === 'unknown' ? -1 : a.localeCompare(b)
  );
  const paidByKey = new Map(cells.map((c) => [`${c.serviceMonth}|${c.checkMonth}`, c.paid]));

  const rowTotal = (serviceMonth: string): number =>
    checkMonths.reduce((sum, checkMonth) => sum + (paidByKey.get(`${serviceMonth}|${checkMonth}`) ?? 0), 0);
  const columnTotal = (checkMonth: string): number =>
    serviceMonths.reduce((sum, serviceMonth) => sum + (paidByKey.get(`${serviceMonth}|${checkMonth}`) ?? 0), 0);
  const grandTotal = cells.reduce((sum, cell) => sum + cell.paid, 0);

  const cellSx = {
    padding: '10px 16px',
    borderBottom: `1px solid ${otherColors.lightDivider}`,
    textAlign: 'right' as const,
    whiteSpace: 'nowrap' as const,
  };
  const headSx = {
    ...cellSx,
    fontWeight: 600,
    fontSize: 13,
    color: 'inherit',
    backgroundColor: '#FAFAFA',
  };

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: `1px solid ${otherColors.lightDivider}`,
        borderRadius: 2,
        px: 2.5,
        py: 2,
        mb: 2.5,
        overflowX: 'auto',
      }}
    >
      <Typography variant="subtitle2" color="primary.dark" fontWeight={600}>
        Insurance Payments Waterfall — Check Date (X), DOS (Y)
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Insurance paid by claim date of service (rows) and ERA check month (columns), across all ERAs
      </Typography>
      {cells.length === 0 ? (
        <Box sx={{ py: 5, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No insurance payments found.
          </Typography>
        </Box>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginTop: 12 }}>
          <thead>
            <tr>
              <th style={{ ...headSx, textAlign: 'left' }}>Date of Service</th>
              {checkMonths.map((checkMonth) => (
                <th key={checkMonth} style={headSx}>
                  {monthLabel(checkMonth)}
                </th>
              ))}
              <th style={headSx}>Row totals</th>
            </tr>
          </thead>
          <tbody>
            {serviceMonths.map((serviceMonth) => (
              <tr key={serviceMonth}>
                <td style={{ ...cellSx, textAlign: 'left', fontWeight: 500 }}>{monthLabel(serviceMonth)}</td>
                {checkMonths.map((checkMonth) => {
                  const paid = paidByKey.get(`${serviceMonth}|${checkMonth}`);
                  return (
                    <td key={checkMonth} style={cellSx}>
                      {paid === undefined ? '' : formatCurrency(paid)}
                    </td>
                  );
                })}
                <td style={{ ...cellSx, fontWeight: 600, backgroundColor: '#FAFAFA' }}>
                  {formatCurrency(rowTotal(serviceMonth))}
                </td>
              </tr>
            ))}
            <tr>
              <td style={{ ...cellSx, textAlign: 'left', fontWeight: 600, borderBottom: 'none' }}>Grand totals</td>
              {checkMonths.map((checkMonth) => (
                <td key={checkMonth} style={{ ...cellSx, fontWeight: 600, borderBottom: 'none' }}>
                  {formatCurrency(columnTotal(checkMonth))}
                </td>
              ))}
              <td style={{ ...cellSx, fontWeight: 600, borderBottom: 'none', backgroundColor: '#FAFAFA' }}>
                {formatCurrency(grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </Box>
  );
}

export default function PaymentsReport(): ReactElement {
  const { oystehrZambda } = useApiClients();

  const [report, setReport] = useState<GetBillingPaymentsReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(() => presetRange(DEFAULT_PRESET).from);
  const [dateTo, setDateTo] = useState(() => presetRange(DEFAULT_PRESET).to);
  const [rangePreset, setRangePreset] = useState<DateRangePreset>(DEFAULT_PRESET);
  const [avgBasis, setAvgBasis] = useState<AvgRateBasis>('allowed');

  const columns = useMemo(() => buildColumns(avgBasis), [avgBasis]);

  const fetchReport = useCallback(
    async (opts?: { refresh?: boolean; from?: string; to?: string }): Promise<void> => {
      if (!oystehrZambda) return;
      setLoading(true);
      setError(null);
      try {
        const params: { dateFrom?: string; dateTo?: string; refresh?: boolean } = {};
        const from = opts?.from ?? dateFrom;
        const to = opts?.to ?? dateTo;
        if (from) params.dateFrom = from;
        if (to) params.dateTo = to;
        if (opts?.refresh) params.refresh = true;
        setReport(await getBillingPaymentsReport(oystehrZambda, params));
      } catch (err) {
        setError(getApiError({ error: err, defaultError: 'Failed to load payments report' }));
      } finally {
        setLoading(false);
      }
    },
    [oystehrZambda, dateFrom, dateTo]
  );

  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!oystehrZambda || initialLoadDone.current) return;
    initialLoadDone.current = true;
    void fetchReport();
  }, [oystehrZambda, fetchReport]);

  const totals = report?.totals;
  const generatedAt = report?.generatedAt
    ? DateTime.fromISO(report.generatedAt).toLocaleString(DateTime.DATETIME_MED)
    : '';

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1.5} mb={3}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" color="primary.dark" fontWeight={600}>
            Payments Report
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Insurance payments from posted ERAs, grouped by payer.
          </Typography>
        </Box>
        {report && (
          <Chip size="small" variant="outlined" label={`${report.fromCache ? 'Cached' : 'Generated'} ${generatedAt}`} />
        )}
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          disabled={loading}
          onClick={() => void fetchReport({ refresh: true })}
        >
          Refresh
        </Button>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} alignItems={{ sm: 'center' }} mb={2.5}>
        <FormControl size="small" sx={{ width: { xs: '100%', sm: 220 } }}>
          <InputLabel>Check Date Range</InputLabel>
          <Select
            label="Check Date Range"
            value={rangePreset}
            onChange={(e) => {
              const preset = e.target.value as DateRangePreset;
              setRangePreset(preset);
              if (preset === 'custom') return; // wait for the user to pick dates
              const { from, to } = presetRange(preset);
              setDateFrom(from);
              setDateTo(to);
              void fetchReport({ from, to });
            }}
          >
            {DATE_RANGE_PRESETS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {rangePreset === 'custom' && (
          <Box sx={{ width: { xs: '100%', sm: 320 } }}>
            <DateRangeInput
              label="Check Date"
              size="small"
              fullWidth
              valueFrom={dateFrom}
              valueTo={dateTo}
              onChange={(from, to) => {
                setDateFrom(from);
                setDateTo(to);
                void fetchReport({ from, to });
              }}
            />
          </Box>
        )}
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography variant="body2" color="text.secondary">
            Avg rate basis:
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={avgBasis}
            onChange={(_e, value: AvgRateBasis | null) => value && setAvgBasis(value)}
          >
            <ToggleButton value="allowed" sx={{ px: 1.5, py: 0.5, textTransform: 'none' }}>
              Allowed
            </ToggleButton>
            <ToggleButton value="insurancePaid" sx={{ px: 1.5, py: 0.5, textTransform: 'none' }}>
              Paid
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Typography variant="h5" color="primary.dark" fontWeight={600} sx={{ mb: 1.5 }}>
        Insurance Payments
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} gap={2} mb={2.5}>
        <StatCard
          label="Insurance Paid"
          value={formatCurrency(totals?.insurancePaid ?? 0)}
          hint={`${totals?.eraCount ?? 0} ERAs · ${totals?.claimCount ?? 0} claims`}
        />
        <StatCard label="Billed" value={formatCurrency(totals?.billed ?? 0)} />
        <StatCard label="Allowed" value={formatCurrency(totals?.allowed ?? 0)} />
        <StatCard
          label={`Avg / Claim (${avgBasis === 'allowed' ? 'Allowed' : 'Paid'})`}
          value={formatCurrency(totals && totals.claimCount > 0 ? totals[avgBasis] / totals.claimCount : 0)}
        />
        <StatCard label="Check Total" value={formatCurrency(totals?.checkTotal ?? 0)} />
      </Stack>

      <DataGridPro
        autoHeight
        rows={report?.rows ?? []}
        getRowId={(row) => `${row.payerId}|${row.payerName}`}
        columns={columns}
        loading={loading}
        disableRowSelectionOnClick
        disableColumnMenu
        hideFooter
        sx={{ ...dataGridSx, mb: 2.5 }}
        slots={dataGridSlots()}
      />

      <WaterfallMatrix cells={report?.waterfall ?? []} />

      <Typography variant="h5" color="primary.dark" fontWeight={600} sx={{ mt: 4, mb: 1.5 }}>
        Patient Payments
      </Typography>
      <Box
        sx={{
          bgcolor: 'background.paper',
          border: `1px dashed ${otherColors.solidLine}`,
          borderRadius: 2,
          px: 3,
          py: 4,
          textAlign: 'center',
        }}
      >
        <Stack direction="row" justifyContent="center" alignItems="center" spacing={1} mb={0.5}>
          <Typography fontWeight={600} color="primary.dark">
            Patient Payments
          </Typography>
          <Chip size="small" label="Coming soon" sx={{ height: 20 }} />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Will summarize patient-responsibility collections (manual and card payments) for the same check date window:
          collected vs outstanding, average days to collect, and collection method mix.
        </Typography>
      </Box>
    </Box>
  );
}
