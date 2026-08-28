import {
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowUp as ArrowUpIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { Fragment, ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Chart } from 'react-google-charts';
import { useNavigate } from 'react-router-dom';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import {
  GetBillingPaymentsReportDrilldownInput,
  PatientPaymentsDrilldownParams,
  ReportDateWindowParams,
} from 'utils/lib/types/data/billing/billing.schemas';
import {
  GetBillingPatientPaymentsDrilldownResponse,
  GetBillingPatientPaymentsReportResponse,
  GetBillingPaymentsReportDrilldownResponse,
  GetBillingPaymentsReportResponse,
  PatientPaymentsReportRow,
  PaymentsReportPayerRow,
  PaymentsReportWaterfallCell,
} from 'utils/lib/types/data/billing/billing.types';
import { formatCurrency } from 'utils/lib/utils/convert';
import {
  getBillingPatientPaymentsDrilldown,
  getBillingPatientPaymentsReport,
  getBillingPaymentsReport,
  getBillingPaymentsReportDrilldown,
} from '../api/api';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { DateRangeInput } from '../components/DateInput';
import { mergeReportStatuses, ReportStatusBar } from '../components/ReportStatusBar';
import { useApiClients } from '../hooks/useAppClients';
import { useBillingReport } from '../hooks/useBillingReport';
import { otherColors } from '../themes/ottehr/colors';

type DateRangePreset =
  | 'previous-month'
  | 'current-month'
  | 'previous-quarter'
  | 'this-quarter'
  | 'year-to-date'
  | 'trailing-30-days'
  | 'trailing-12-months'
  | 'custom';

const DATE_RANGE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'previous-month', label: 'Previous Month' },
  { value: 'current-month', label: 'Current Month' },
  { value: 'previous-quarter', label: 'Previous Quarter' },
  { value: 'this-quarter', label: 'This Quarter' },
  { value: 'year-to-date', label: 'Year-to-Date' },
  { value: 'trailing-30-days', label: 'Trailing 30 Days' },
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
    case 'trailing-30-days':
      return { from: now.minus({ days: 30 }).toISODate() ?? '', to: now.toISODate() ?? '' };
    case 'trailing-12-months':
      return { from: now.minus({ months: 12 }).toISODate() ?? '', to: now.toISODate() ?? '' };
    case 'custom':
      return { from: '', to: '' };
  }
};

const DEFAULT_PRESET: DateRangePreset = 'trailing-30-days';

const currencyCol = (field: string, headerName: string, width = 130): GridColDef => ({
  field,
  headerName,
  width,
  align: 'right',
  headerAlign: 'right',
  valueFormatter: (params: { value: number }) => formatCurrency(params.value),
});

const payerColumns: GridColDef[] = [
  { field: 'payerName', headerName: 'Payer', flex: 1, minWidth: 220 },
  { field: 'payerId', headerName: 'Payer ID', width: 110 },
  { field: 'eraCount', headerName: 'ERAs', width: 80, align: 'right', headerAlign: 'right' },
  { field: 'claimCount', headerName: 'Claims', width: 90, align: 'right', headerAlign: 'right' },
  currencyCol('billed', 'Billed'),
  currencyCol('allowed', 'Allowed'),
  currencyCol('insurancePaid', 'Insurance Paid', 140),
  {
    ...currencyCol('avgAllowedPerClaim', 'Avg Allowed / Claim', 160),
    valueGetter: (params) => {
      const row = params.row as PaymentsReportPayerRow;
      return row.claimCount > 0 ? row.allowed / row.claimCount : 0;
    },
  },
  {
    ...currencyCol('avgPaidPerClaim', 'Avg Paid / Claim', 150),
    valueGetter: (params) => {
      const row = params.row as PaymentsReportPayerRow;
      return row.claimCount > 0 ? row.insurancePaid / row.claimCount : 0;
    },
  },
  currencyCol('checkTotal', 'Check Total', 130),
];

const OVERVIEW_COLORS = ['#3f79c1', '#7fb069'];

function OverviewBox({
  title,
  total,
  hint,
  parts,
}: {
  title: string;
  total: number;
  hint?: string;
  parts: { label: string; value: number }[];
}): ReactElement {
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: `1px solid ${otherColors.lightDivider}`,
        borderRadius: 2,
        p: 2,
        flex: 1,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {title}
      </Typography>
      <Stack direction="row" alignItems="center" gap={2}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" fontWeight={600} sx={{ mt: 0.5 }}>
            {formatCurrency(total)}
          </Typography>
          {hint && (
            <Typography variant="caption" color="text.secondary">
              {hint}
            </Typography>
          )}
          <Stack mt={1.5} gap={0.75}>
            {parts.map((part, index) => (
              <Stack key={part.label} direction="row" alignItems="center" gap={1}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: OVERVIEW_COLORS[index] }} />
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                  {part.label}
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {formatCurrency(part.value)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
        {parts.some((part) => part.value > 0) && (
          <Box sx={{ width: 150, display: { xs: 'none', sm: 'block' } }}>
            <Chart
              chartType="PieChart"
              width="100%"
              height="140px"
              data={[['Part', 'Amount'], ...parts.map((part) => [part.label, Math.max(part.value, 0)])]}
              options={{
                colors: OVERVIEW_COLORS,
                pieHole: 0.5,
                legend: 'none',
                chartArea: { width: '92%', height: '92%' },
                backgroundColor: 'transparent',
              }}
            />
          </Box>
        )}
      </Stack>
    </Box>
  );
}

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

const dayLabel = (day: string): string => (day ? DateTime.fromISO(day).toLocaleString(DateTime.DATE_MED) : '—');

// e.g. "Aug 1, 2026 – Aug 18, 2026" describing which ERAs (by check date) the drawer pulled
const checkRangeLabel = (params: GetBillingPaymentsReportDrilldownInput): string => {
  if (params.checkMonth) {
    if (params.checkMonth === 'unknown') return 'ERAs with no check date';
    const month = DateTime.fromISO(`${params.checkMonth}-01`);
    return `ERAs with check dates ${dayLabel(month.toISODate() ?? '')} – ${dayLabel(
      month.endOf('month').toISODate() ?? ''
    )}`;
  }
  if (params.dateFrom && params.dateTo)
    return `ERAs with check dates ${dayLabel(params.dateFrom)} – ${dayLabel(params.dateTo)}`;
  if (params.dateFrom) return `ERAs with check dates from ${dayLabel(params.dateFrom)}`;
  if (params.dateTo) return `ERAs with check dates through ${dayLabel(params.dateTo)}`;
  return 'All ERAs';
};

interface DrilldownCriteria {
  title: string;
  params: GetBillingPaymentsReportDrilldownInput;
}

const drilldownCellSx = {
  padding: '8px 14px',
  borderBottom: `1px solid ${otherColors.lightDivider}`,
  textAlign: 'right' as const,
  whiteSpace: 'nowrap' as const,
};
const drilldownHeadSx = { ...drilldownCellSx, fontWeight: 600, fontSize: 13, backgroundColor: '#FAFAFA' };

function DrilldownDialog({
  criteria,
  onClose,
}: {
  criteria: DrilldownCriteria | null;
  onClose: () => void;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [data, setData] = useState<GetBillingPaymentsReportDrilldownResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!criteria || !oystehrZambda) return;
    setData(null);
    setError(null);
    setExpandedIds([]);
    setLoading(true);
    getBillingPaymentsReportDrilldown(oystehrZambda, criteria.params)
      .then(setData)
      .catch((err) => setError(getApiError({ error: err, defaultError: 'Failed to load ERA details' })))
      .finally(() => setLoading(false));
  }, [criteria, oystehrZambda]);

  const toggle = (id: string): void =>
    setExpandedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <Drawer
      anchor="right"
      open={!!criteria}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', md: 'calc(100% - 220px)' } } }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 3,
          py: 2,
          borderBottom: `1px solid ${otherColors.lightDivider}`,
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 18, color: 'primary.dark' }}>{criteria?.title}</Typography>
          {criteria && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {checkRangeLabel(criteria.params)}
              {data?.generatedAt
                ? ` — as of ${DateTime.fromISO(data.generatedAt).toLocaleString(DateTime.DATETIME_MED)}`
                : ''}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </Box>
      <Box sx={{ px: 3, py: 2.5, overflowY: 'auto', flex: 1 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (data?.eras.length ?? 0) === 0 ? (
          !error && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No ERAs match these criteria.
            </Typography>
          )
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ ...drilldownHeadSx, width: 36 }} />
                <th style={{ ...drilldownHeadSx, textAlign: 'left' }}>Check #</th>
                <th style={{ ...drilldownHeadSx, textAlign: 'left' }}>Check Date</th>
                <th style={{ ...drilldownHeadSx, textAlign: 'left' }}>Payer</th>
                <th style={drilldownHeadSx}>Claims</th>
                <th style={drilldownHeadSx}>Check Amount</th>
              </tr>
            </thead>
            <tbody>
              {data?.eras.map((era) => (
                <Fragment key={era.id}>
                  <tr style={{ cursor: 'pointer' }} onClick={() => toggle(era.id)}>
                    <td style={drilldownCellSx}>
                      {expandedIds.includes(era.id) ? (
                        <ArrowUpIcon sx={{ fontSize: 18, color: 'action.active' }} />
                      ) : (
                        <ArrowDownIcon sx={{ fontSize: 18, color: 'action.active' }} />
                      )}
                    </td>
                    <td style={{ ...drilldownCellSx, textAlign: 'left', fontWeight: 500 }}>{era.checkNumber || '—'}</td>
                    <td style={{ ...drilldownCellSx, textAlign: 'left' }}>{dayLabel(era.checkDate)}</td>
                    <td style={{ ...drilldownCellSx, textAlign: 'left' }}>{era.payerName}</td>
                    <td style={drilldownCellSx}>{era.claims.length}</td>
                    <td style={{ ...drilldownCellSx, fontWeight: 600 }}>{formatCurrency(era.checkAmount)}</td>
                  </tr>
                  <tr>
                    <td colSpan={6} style={{ padding: 0, border: 'none' }}>
                      <Collapse in={expandedIds.includes(era.id)} timeout="auto" unmountOnExit={false}>
                        <Box
                          sx={{
                            maxHeight: 260,
                            overflowY: 'auto',
                            backgroundColor: '#FAFAFA',
                            borderBottom: `1px solid ${otherColors.lightDivider}`,
                            px: 3,
                            py: 1.5,
                          }}
                        >
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                              <tr>
                                <th style={{ ...drilldownHeadSx, textAlign: 'left' }}>Patient</th>
                                <th style={{ ...drilldownHeadSx, textAlign: 'left' }}>PCN</th>
                                <th style={{ ...drilldownHeadSx, textAlign: 'left' }}>Date of Service</th>
                                <th style={drilldownHeadSx}>Billed</th>
                                <th style={drilldownHeadSx}>Allowed</th>
                                <th style={drilldownHeadSx}>Paid</th>
                                <th style={drilldownHeadSx}>Patient Resp</th>
                              </tr>
                            </thead>
                            <tbody>
                              {era.claims.map((claim, claimIndex) => (
                                <tr key={claimIndex}>
                                  <td style={{ ...drilldownCellSx, textAlign: 'left', fontWeight: 500 }}>
                                    {claim.patientName || 'Unknown Patient'}
                                  </td>
                                  <td style={{ ...drilldownCellSx, textAlign: 'left' }}>{claim.pcn || '—'}</td>
                                  <td style={{ ...drilldownCellSx, textAlign: 'left' }}>{dayLabel(claim.dos)}</td>
                                  <td style={drilldownCellSx}>{formatCurrency(claim.billed)}</td>
                                  <td style={drilldownCellSx}>{formatCurrency(claim.allowed)}</td>
                                  <td style={{ ...drilldownCellSx, fontWeight: 600 }}>{formatCurrency(claim.paid)}</td>
                                  <td style={drilldownCellSx}>{formatCurrency(claim.patientResp)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </Box>
                      </Collapse>
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Box>
    </Drawer>
  );
}

const methodLabel = (method: string): string => {
  if (method === 'unknown') return 'Unknown';
  if (method === 'invoice') return 'Invoice';
  return method.charAt(0).toUpperCase() + method.slice(1).replace(/_/g, ' ');
};

const stripeStatusColor = (status: string): 'success' | 'warning' | 'error' | 'default' => {
  if (status === 'Paid' || status === 'Invoice paid') return 'success';
  if (status === 'Invoice past due') return 'error';
  if (status === 'Invoice status unavailable') return 'default';
  if (status.startsWith('Invoice') || status.includes('refunded') || status === 'Refunded') return 'warning';
  return 'default';
};

const patientPaymentColumns: GridColDef[] = [
  { field: 'locationName', headerName: 'Location', flex: 1, minWidth: 200 },
  {
    field: 'paymentMethod',
    headerName: 'Payment Method',
    width: 160,
    valueFormatter: (params: { value: string }) => methodLabel(params.value),
  },
  { field: 'paymentCount', headerName: 'Payments', width: 100, align: 'right', headerAlign: 'right' },
  currencyCol('collected', 'Collected'),
  currencyCol('refunded', 'Refunded'),
  currencyCol('net', 'Net'),
];

interface PatientPaymentsCriteria {
  title: string;
  params: ReportDateWindowParams & PatientPaymentsDrilldownParams;
}

function PatientPaymentsDrawer({
  criteria,
  onClose,
}: {
  criteria: PatientPaymentsCriteria | null;
  onClose: () => void;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [data, setData] = useState<GetBillingPatientPaymentsDrilldownResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!criteria || !oystehrZambda) return;
    setData(null);
    setError(null);
    setLoading(true);
    const { dateFrom, dateTo, locationId, paymentMethod } = criteria.params;
    getBillingPatientPaymentsDrilldown(
      oystehrZambda,
      { ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) },
      { ...(locationId ? { locationId } : {}), ...(paymentMethod ? { paymentMethod } : {}) }
    )
      .then(setData)
      .catch((err) => setError(getApiError({ error: err, defaultError: 'Failed to load payments' })))
      .finally(() => setLoading(false));
  }, [criteria, oystehrZambda]);

  return (
    <Drawer
      anchor="right"
      open={!!criteria}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', md: 'calc(100% - 220px)' } } }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 3,
          py: 2,
          borderBottom: `1px solid ${otherColors.lightDivider}`,
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 18, color: 'primary.dark' }}>{criteria?.title}</Typography>
          {criteria && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {criteria.params.dateFrom && criteria.params.dateTo
                ? `Payments ${dayLabel(criteria.params.dateFrom)} – ${dayLabel(criteria.params.dateTo)}`
                : 'All payments'}
              {data?.generatedAt
                ? ` — as of ${DateTime.fromISO(data.generatedAt).toLocaleString(DateTime.DATETIME_MED)}`
                : ''}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </Box>
      <Box sx={{ px: 3, py: 2.5, overflowY: 'auto', flex: 1 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (data?.payments?.length ?? 0) === 0 ? (
          !error && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No payments match these criteria.
            </Typography>
          )
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ ...drilldownHeadSx, textAlign: 'left' }}>Date</th>
                <th style={{ ...drilldownHeadSx, textAlign: 'left' }}>Patient</th>
                <th style={{ ...drilldownHeadSx, textAlign: 'left' }}>Location</th>
                <th style={{ ...drilldownHeadSx, textAlign: 'left' }}>Method</th>
                <th style={drilldownHeadSx}>Amount</th>
                <th style={{ ...drilldownHeadSx, textAlign: 'left' }}>Stripe Status</th>
                <th style={{ ...drilldownHeadSx, textAlign: 'left' }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {data?.payments?.map((payment, index) => (
                <tr key={index}>
                  <td style={{ ...drilldownCellSx, textAlign: 'left' }}>{dayLabel(payment.date.slice(0, 10))}</td>
                  <td style={{ ...drilldownCellSx, textAlign: 'left', fontWeight: 500 }}>
                    {payment.patientName || '—'}
                  </td>
                  <td style={{ ...drilldownCellSx, textAlign: 'left' }}>{payment.locationName}</td>
                  <td style={{ ...drilldownCellSx, textAlign: 'left' }}>{methodLabel(payment.paymentMethod)}</td>
                  <td style={{ ...drilldownCellSx, fontWeight: 600 }}>{formatCurrency(payment.amount)}</td>
                  <td style={{ ...drilldownCellSx, textAlign: 'left' }}>
                    {payment.stripeStatus ? (
                      <Chip
                        size="small"
                        variant="outlined"
                        color={stripeStatusColor(payment.stripeStatus)}
                        label={payment.stripeStatus}
                        sx={{ height: 20, fontSize: 12 }}
                      />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ ...drilldownCellSx, textAlign: 'left', whiteSpace: 'normal' }}>
                    {payment.appointmentId && (
                      <Link
                        href={`${import.meta.env.VITE_APP_EHR_URL}/visit/${payment.appointmentId}`}
                        target="_blank"
                        rel="noopener"
                        underline="hover"
                        sx={{ fontWeight: 500, mr: 1 }}
                      >
                        {dayLabel(payment.encounterDate.slice(0, 10))}
                      </Link>
                    )}
                    {payment.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Box>
    </Drawer>
  );
}

// DOS × check-month matrix (lag triangle): rows are service months, columns are check months,
// cells are insurance dollars paid — always spanning all ERAs, independent of the range filter.
function WaterfallMatrix({
  cells,
  onCellClick,
}: {
  cells: PaymentsReportWaterfallCell[];
  onCellClick: (serviceMonth: string, checkMonth: string) => void;
}): ReactElement {
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
                      {paid === undefined ? (
                        ''
                      ) : (
                        <button
                          type="button"
                          onClick={() => onCellClick(serviceMonth, checkMonth)}
                          aria-label={`View ERAs for ${monthLabel(serviceMonth)} service, ${monthLabel(
                            checkMonth
                          )} checks`}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            font: 'inherit',
                            cursor: 'pointer',
                            color: '#2169F5',
                          }}
                        >
                          {formatCurrency(paid)}
                        </button>
                      )}
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
  const navigate = useNavigate();

  const [dateFrom, setDateFrom] = useState(() => presetRange(DEFAULT_PRESET).from);
  const [dateTo, setDateTo] = useState(() => presetRange(DEFAULT_PRESET).to);
  const [rangePreset, setRangePreset] = useState<DateRangePreset>(DEFAULT_PRESET);
  const [drilldown, setDrilldown] = useState<DrilldownCriteria | null>(null);
  const [patientDrilldown, setPatientDrilldown] = useState<PatientPaymentsCriteria | null>(null);

  const windowParams = useMemo(
    () => ({ ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) }),
    [dateFrom, dateTo]
  );

  const {
    report,
    status: insuranceStatus,
    loading,
    error,
    clearError,
    refresh: refreshInsurance,
  } = useBillingReport<GetBillingPaymentsReportResponse>({
    fetch: useCallback(
      (client: Oystehr, refresh?: boolean) => getBillingPaymentsReport(client, windowParams, refresh),
      [windowParams]
    ),
    errorMessage: 'Failed to load payments report',
  });

  const {
    report: patientReport,
    status: patientStatus,
    loading: patientLoading,
    error: patientError,
    clearError: clearPatientError,
    refresh: refreshPatient,
  } = useBillingReport<GetBillingPatientPaymentsReportResponse>({
    fetch: useCallback(
      (client: Oystehr, refresh?: boolean) => getBillingPatientPaymentsReport(client, windowParams, refresh),
      [windowParams]
    ),
    errorMessage: 'Failed to load patient payments',
  });

  const totals = report?.totals;
  const insurancePaid = totals?.insurancePaid ?? 0;
  const patientCollected = patientReport?.totals.net ?? 0;
  const patientResp = totals?.patientResp ?? 0;
  const totalCollected = insurancePaid + patientCollected;

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
            Payments Report
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Insurance payments from posted ERAs, grouped by payer.
          </Typography>
        </Box>
        <ReportStatusBar
          status={mergeReportStatuses(insuranceStatus, patientStatus)}
          loading={loading || patientLoading}
          onRefresh={() => {
            refreshInsurance();
            refreshPatient();
          }}
        />
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
              }}
            />
          </Box>
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>
          {error}
        </Alert>
      )}

      <Typography variant="h5" color="primary.dark" fontWeight={600} sx={{ mb: 1.5 }}>
        Overview
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} gap={2} mb={2.5}>
        <OverviewBox
          title="Total Payments"
          total={totalCollected}
          hint="Everything collected in this window"
          parts={[
            { label: 'Paid by insurance', value: insurancePaid },
            { label: 'Paid by patients', value: patientCollected },
          ]}
        />
        <OverviewBox
          title="Allowed by Insurance"
          total={totals?.allowed ?? 0}
          hint="From this window's ERAs"
          parts={[
            { label: 'Paid by insurance', value: insurancePaid },
            { label: 'Patient responsibility', value: patientResp },
          ]}
        />
      </Stack>

      <Typography variant="h5" color="primary.dark" fontWeight={600} sx={{ mb: 1.5 }}>
        Insurance Payments
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} gap={2} mb={2.5}>
        <StatCard
          label="Billed"
          value={formatCurrency(totals?.billed ?? 0)}
          hint={`${totals?.eraCount ?? 0} ERAs · ${totals?.claimCount ?? 0} claims`}
        />
        <StatCard label="Allowed" value={formatCurrency(totals?.allowed ?? 0)} />
        <StatCard label="Paid" value={formatCurrency(totals?.insurancePaid ?? 0)} hint="From claim paid amounts" />
        <StatCard label="Check Total" value={formatCurrency(totals?.checkTotal ?? 0)} hint="Sum of ERA check amounts" />
        <StatCard
          label="Avg Allowed / Claim"
          value={formatCurrency(totals && totals.claimCount > 0 ? totals.allowed / totals.claimCount : 0)}
        />
        <StatCard
          label="Avg Paid / Claim"
          value={formatCurrency(totals && totals.claimCount > 0 ? totals.insurancePaid / totals.claimCount : 0)}
        />
      </Stack>

      <DataGridPro
        autoHeight
        rows={report?.rows ?? []}
        getRowId={(row) => `${row.payerId}|${row.payerName}`}
        columns={payerColumns}
        loading={loading}
        disableRowSelectionOnClick
        disableColumnMenu
        hideFooter
        onRowClick={(gridRow) => {
          const row = gridRow.row as PaymentsReportPayerRow;
          setDrilldown({
            title: `${row.payerName} — ERAs`,
            params: {
              payerId: row.payerId || 'none',
              ...(dateFrom ? { dateFrom } : {}),
              ...(dateTo ? { dateTo } : {}),
            },
          });
        }}
        sx={{ ...dataGridSx, mb: 2.5 }}
        slots={dataGridSlots()}
      />

      <WaterfallMatrix
        cells={report?.waterfall ?? []}
        onCellClick={(serviceMonth, checkMonth) =>
          setDrilldown({
            title: `ERAs — DOS ${monthLabel(serviceMonth)}, Check ${monthLabel(checkMonth)}`,
            params: { serviceMonth, checkMonth },
          })
        }
      />

      <DrilldownDialog criteria={drilldown} onClose={() => setDrilldown(null)} />

      <Typography variant="h5" color="primary.dark" fontWeight={600} sx={{ mt: 4, mb: 1.5 }}>
        Patient Payments
      </Typography>

      {patientError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={clearPatientError}>
          {patientError}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} gap={2} mb={2.5}>
        {(['card', 'cash', 'check', 'invoice'] as const).map((method) => {
          const methodRows = (patientReport?.rows ?? []).filter((row) => row.paymentMethod === method);
          const collected = methodRows.reduce((sum, row) => sum + row.collected, 0);
          const count = methodRows.reduce((sum, row) => sum + row.paymentCount, 0);
          return (
            <StatCard
              key={method}
              label={method === 'invoice' ? 'Invoices' : method === 'check' ? 'Checks' : methodLabel(method)}
              value={formatCurrency(collected)}
              hint={`${count} payments`}
            />
          );
        })}
        <StatCard
          label="Other"
          value={formatCurrency(
            (patientReport?.rows ?? [])
              .filter((row) => !['card', 'cash', 'check', 'invoice'].includes(row.paymentMethod))
              .reduce((sum, row) => sum + row.collected, 0)
          )}
          hint={`${(patientReport?.rows ?? [])
            .filter((row) => !['card', 'cash', 'check', 'invoice'].includes(row.paymentMethod))
            .reduce((sum, row) => sum + row.paymentCount, 0)} payments`}
        />
        <StatCard label="Refunded" value={formatCurrency(patientReport?.totals.refunded ?? 0)} />
        <StatCard
          label="Net"
          value={formatCurrency(patientReport?.totals.net ?? 0)}
          hint={`${patientReport?.totals.paymentCount ?? 0} payments total`}
        />
      </Stack>

      <DataGridPro
        autoHeight
        rows={patientReport?.rows ?? []}
        getRowId={(row) => `${row.locationId || row.locationName}|${row.paymentMethod}`}
        columns={patientPaymentColumns}
        loading={patientLoading}
        disableRowSelectionOnClick
        disableColumnMenu
        hideFooter
        onRowClick={(gridRow) => {
          const row = gridRow.row as PatientPaymentsReportRow;
          setPatientDrilldown({
            title: `${row.locationName} — ${methodLabel(row.paymentMethod)} Payments`,
            params: {
              // 'none' selects payments with no resolvable location
              locationId: row.locationId || 'none',
              paymentMethod: row.paymentMethod,
              ...(dateFrom ? { dateFrom } : {}),
              ...(dateTo ? { dateTo } : {}),
            },
          });
        }}
        sx={dataGridSx}
        slots={dataGridSlots()}
      />

      <PatientPaymentsDrawer criteria={patientDrilldown} onClose={() => setPatientDrilldown(null)} />
    </Box>
  );
}
