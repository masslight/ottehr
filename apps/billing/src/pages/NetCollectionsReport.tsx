import {
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowUp as ArrowUpIcon,
} from '@mui/icons-material';
import { Alert, Box, Button, CircularProgress, Collapse, Drawer, IconButton, Stack, Typography } from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { Fragment, ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Chart } from 'react-google-charts';
import { useNavigate } from 'react-router-dom';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { ReportDateWindowParams } from 'utils/lib/types/data/billing/billing.schemas';
import {
  GetBillingNetCollectionsDrilldownResponse,
  GetBillingNetCollectionsReportResponse,
  NetCollectionsBucket,
  NetCollectionsPayerRow,
} from 'utils/lib/types/data/billing/billing.types';
import { formatCurrency } from 'utils/lib/utils/convert';
import { getBillingNetCollectionsDrilldown, getBillingNetCollectionsReport } from '../api/api';
import { dataGridSlots, dataGridSx, drilldownIndicatorColumn } from '../components/BillingDataGrid';
import { ReportStatusBar, sameWindow, windowParamsOf } from '../components/ReportStatusBar';
import { RichTooltip } from '../components/RichTooltip';
import { useApiClients } from '../hooks/useAppClients';
import { useBillingReport } from '../hooks/useBillingReport';
import { useBillingReportHistory } from '../hooks/useBillingReportHistory';
import { otherColors } from '../themes/ottehr/colors';
import { reportPalette } from '../themes/ottehr/reportPalette';

const rateOf = (bucket: NetCollectionsBucket): number | null =>
  bucket.expected > 0 ? (bucket.collected / bucket.expected) * 100 : null;

const rateLabel = (rate: number | null): string => (rate === null ? '—' : `${rate.toFixed(1)}%`);

const ncrColor = (rate: number | null): string => {
  if (rate === null) return 'text.disabled';
  if (rate >= 95) return reportPalette.netCollections.good;
  if (rate >= 85) return reportPalette.netCollections.fair;
  return reportPalette.netCollections.poor;
};

const monthLabel = (month: string): string => DateTime.fromISO(`${month}-01`).toFormat('MMM yyyy');

const dayLabel = (day: string): string => (day ? DateTime.fromISO(day).toLocaleString(DateTime.DATE_MED) : '—');

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
  { field: 'claimCount', headerName: 'Claims', width: 90, align: 'right', headerAlign: 'right' },
  currencyCol('allowed', 'Allowed'),
  currencyCol('patientResp', 'Patient Resp', 140),
  currencyCol('expected', 'Expected', 140),
  currencyCol('paid', 'Insurance Paid', 140),
  {
    field: 'rate',
    headerName: 'NCR',
    width: 100,
    align: 'right',
    headerAlign: 'right',
    valueGetter: (params) => {
      const row = params.row as NetCollectionsPayerRow;
      return row.expected > 0 ? (row.paid / row.expected) * 100 : null;
    },
    renderCell: (params) => {
      const rate = params.value as number | null;
      return (
        <Typography variant="body2" fontWeight={600} sx={{ color: ncrColor(rate) }}>
          {rateLabel(rate)}
        </Typography>
      );
    },
  },
];

// one labeled quantity inside a formula (label above its dollar amounts)
function Term({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <Stack alignItems="center" sx={{ px: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>
        {value}
      </Typography>
    </Stack>
  );
}

interface FormulaTerm {
  label: string;
  value: string;
}

// proper fraction: numerator over a rule over denominator, '= rate' alongside
function FractionFormula({
  numerator,
  denominator,
  rate,
}: {
  numerator: FormulaTerm;
  denominator: FormulaTerm;
  rate: number | null;
}): ReactElement {
  return (
    <Stack direction="row" alignItems="center" gap={1} sx={{ p: 1 }}>
      <Stack alignItems="center">
        <Term {...numerator} />
        <Box sx={{ borderTop: '1.5px solid', borderColor: 'text.primary', alignSelf: 'stretch', my: 0.75 }} />
        <Term {...denominator} />
      </Stack>
      <Typography variant="h6" color="text.secondary">
        =
      </Typography>
      <Typography variant="h6" fontWeight={600} sx={{ color: ncrColor(rate) }}>
        {rateLabel(rate)}
      </Typography>
    </Stack>
  );
}

// stat card with the formula as a proper fraction in a rich hover panel
function RateCard({
  label,
  bucket,
  numerator,
  denominator,
}: {
  label: string;
  bucket: NetCollectionsBucket;
  numerator: FormulaTerm;
  denominator: FormulaTerm;
}): ReactElement {
  const rate = rateOf(bucket);
  return (
    <RichTooltip title={<FractionFormula numerator={numerator} denominator={denominator} rate={rate} />}>
      <Box
        sx={{
          flex: 1,
          minWidth: 180,
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
        <Typography variant="h4" fontWeight={600} sx={{ mt: 0.5, color: ncrColor(rate) }}>
          {rateLabel(rate)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {`${formatCurrency(bucket.collected)} of ${formatCurrency(bucket.expected)}`}
        </Typography>
      </Box>
    </RichTooltip>
  );
}

// e.g. "ERAs with check dates Aug 1, 2026 – Aug 18, 2026" describing which ERAs the drawer pulled
const checkRangeLabel = (params: ReportDateWindowParams): string => {
  if (params.dateFrom && params.dateTo)
    return `ERAs with check dates ${dayLabel(params.dateFrom)} – ${dayLabel(params.dateTo)}`;
  if (params.dateFrom) return `ERAs with check dates from ${dayLabel(params.dateFrom)}`;
  if (params.dateTo) return `ERAs with check dates through ${dayLabel(params.dateTo)}`;
  return 'All ERAs';
};

interface PayerErasCriteria {
  title: string;
  payerId: string;
  window: ReportDateWindowParams;
}

const drilldownCellSx = {
  padding: '8px 14px',
  borderBottom: `1px solid ${otherColors.lightDivider}`,
  textAlign: 'right' as const,
  whiteSpace: 'nowrap' as const,
};
const drilldownHeadSx = { ...drilldownCellSx, fontWeight: 600, fontSize: 13, backgroundColor: reportPalette.mutedBg };

function PayerErasDrawer({
  criteria,
  onClose,
}: {
  criteria: PayerErasCriteria | null;
  onClose: () => void;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [data, setData] = useState<GetBillingNetCollectionsDrilldownResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!criteria || !oystehrZambda) return;
    setData(null);
    setError(null);
    setExpandedIds([]);
    setLoading(true);
    getBillingNetCollectionsDrilldown(oystehrZambda, criteria.window, { payerId: criteria.payerId })
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
              {checkRangeLabel(criteria.window)}
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
                <th style={drilldownHeadSx}>Matched Claims</th>
                <th style={drilldownHeadSx}>Allowed</th>
                <th style={drilldownHeadSx}>Patient Resp</th>
                <th style={drilldownHeadSx}>Expected</th>
                <th style={drilldownHeadSx}>Paid</th>
                <th style={drilldownHeadSx}>NCR</th>
              </tr>
            </thead>
            <tbody>
              {data?.eras.map((era) => {
                const expected = era.allowed - era.patientResp;
                const rate = rateOf({ collected: era.paid, expected });
                return (
                  <Fragment key={era.id}>
                    <tr style={{ cursor: 'pointer' }} onClick={() => toggle(era.id)}>
                      <td style={drilldownCellSx}>
                        <IconButton
                          size="small"
                          aria-label={`${expandedIds.includes(era.id) ? 'Collapse' : 'Expand'} claims for check ${
                            era.checkNumber || era.id
                          }`}
                          aria-expanded={expandedIds.includes(era.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle(era.id);
                          }}
                        >
                          {expandedIds.includes(era.id) ? (
                            <ArrowUpIcon sx={{ fontSize: 18, color: 'action.active' }} />
                          ) : (
                            <ArrowDownIcon sx={{ fontSize: 18, color: 'action.active' }} />
                          )}
                        </IconButton>
                      </td>
                      <td style={{ ...drilldownCellSx, textAlign: 'left', fontWeight: 500 }}>
                        {era.checkNumber || '—'}
                      </td>
                      <td style={{ ...drilldownCellSx, textAlign: 'left' }}>{dayLabel(era.checkDate)}</td>
                      <td style={drilldownCellSx}>{era.claims.length}</td>
                      <td style={drilldownCellSx}>{formatCurrency(era.allowed)}</td>
                      <td style={drilldownCellSx}>{formatCurrency(era.patientResp)}</td>
                      <td style={drilldownCellSx}>{formatCurrency(expected)}</td>
                      <td style={{ ...drilldownCellSx, fontWeight: 600 }}>{formatCurrency(era.paid)}</td>
                      <td style={{ ...drilldownCellSx, fontWeight: 600, color: ncrColor(rate) }}>{rateLabel(rate)}</td>
                    </tr>
                    <tr>
                      <td colSpan={9} style={{ padding: 0, border: 'none' }}>
                        <Collapse in={expandedIds.includes(era.id)} timeout="auto" unmountOnExit={false}>
                          <Box
                            sx={{
                              maxHeight: 260,
                              overflowY: 'auto',
                              backgroundColor: reportPalette.mutedBg,
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
                                  <th style={drilldownHeadSx}>Allowed</th>
                                  <th style={drilldownHeadSx}>Patient Resp</th>
                                  <th style={drilldownHeadSx}>Paid</th>
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
                                    <td style={drilldownCellSx}>{formatCurrency(claim.allowed)}</td>
                                    <td style={drilldownCellSx}>{formatCurrency(claim.patientResp)}</td>
                                    <td style={{ ...drilldownCellSx, fontWeight: 600 }}>
                                      {formatCurrency(claim.paid)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </Box>
                        </Collapse>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Box>
    </Drawer>
  );
}

export default function NetCollectionsReport(): ReactElement {
  const navigate = useNavigate();

  const { entries: history, reload: reloadHistory } = useBillingReportHistory('net-collections');
  // null until the latest cached run (or the empty state) is adopted from history
  const [range, setRange] = useState<ReportDateWindowParams | null>(null);
  useEffect(() => {
    if (history) setRange((current) => current ?? windowParamsOf(history[0]?.params));
  }, [history]);
  const { dateFrom, dateTo } = range ?? {};

  const { report, status, loading, error, clearError, refresh, refreshNext } =
    useBillingReport<GetBillingNetCollectionsReportResponse>({
      fetch: useCallback(
        (client: Oystehr, refresh?: boolean) => getBillingNetCollectionsReport(client, range ?? {}, refresh),
        [range]
      ),
      errorMessage: 'Failed to load net collections report',
      enabled: range !== null,
    });

  const runReport = (params: ReportDateWindowParams): void => {
    if (sameWindow(params, range)) {
      refresh();
      return;
    }
    refreshNext();
    setRange(params);
  };

  const [drilldown, setDrilldown] = useState<PayerErasCriteria | null>(null);

  const overall = report?.overall ?? { collected: 0, expected: 0 };
  const insurance = report?.insurance ?? { collected: 0, expected: 0 };
  const patient = report?.patient ?? { collected: 0, expected: 0 };
  const uncollected = Math.max(overall.expected - overall.collected, 0);

  const trendData = useMemo(() => {
    const header = ['Month', 'Insurance', 'Patient', 'Overall'];
    const rows = (report?.monthly ?? []).map((point) => {
      const overallMonth = {
        collected: point.insurance.collected + point.patient.collected,
        expected: point.insurance.expected + point.patient.expected,
      };
      return [monthLabel(point.month), rateOf(point.insurance), rateOf(point.patient), rateOf(overallMonth)];
    });
    return [header, ...rows];
  }, [report]);

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
            Net Collections Report
          </Typography>
        </Box>
        <ReportStatusBar
          status={status}
          loading={loading}
          dateFrom={dateFrom}
          dateTo={dateTo}
          history={{
            entries: history,
            onOpen: reloadHistory,
            onView: setRange,
            onRun: runReport,
            rangeLabel: 'Check Date Range',
          }}
        />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} gap={2} mb={2.5}>
        <RateCard
          label="Overall NCR"
          bucket={overall}
          numerator={{
            label: 'insurance paid + patient collected',
            value: `${formatCurrency(insurance.collected)} + ${formatCurrency(patient.collected)}`,
          }}
          denominator={{ label: 'allowed', value: formatCurrency(overall.expected) }}
        />
        <RateCard
          label="Insurance NCR"
          bucket={insurance}
          numerator={{ label: 'insurance paid', value: formatCurrency(insurance.collected) }}
          denominator={{
            label: 'allowed − patient responsibility',
            value: `${formatCurrency(overall.expected)} − ${formatCurrency(patient.expected)}`,
          }}
        />
        <RateCard
          label="Patient NCR"
          bucket={patient}
          numerator={{ label: 'patient collected (net of refunds)', value: formatCurrency(patient.collected) }}
          denominator={{ label: 'patient responsibility', value: formatCurrency(patient.expected) }}
        />
        <RichTooltip
          title={
            <Stack direction="row" alignItems="center" gap={0.5} sx={{ p: 1 }}>
              <Term label="allowed" value={formatCurrency(overall.expected)} />
              <Typography variant="h6" color="text.secondary">
                −
              </Typography>
              <Term label="insurance paid" value={formatCurrency(insurance.collected)} />
              <Typography variant="h6" color="text.secondary">
                −
              </Typography>
              <Term label="patient collected" value={formatCurrency(patient.collected)} />
              <Typography variant="h6" color="text.secondary">
                =
              </Typography>
              <Typography variant="h6" fontWeight={600}>
                {formatCurrency(uncollected)}
              </Typography>
            </Stack>
          }
          customWidth={520}
        >
          <Box
            sx={{
              flex: 1,
              minWidth: 180,
              bgcolor: 'background.paper',
              border: `1px solid ${otherColors.lightDivider}`,
              borderRadius: 2,
              px: 2.5,
              py: 2,
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}
            >
              Uncollected
            </Typography>
            <Typography variant="h4" fontWeight={600} color="primary.dark" sx={{ mt: 0.5 }}>
              {formatCurrency(uncollected)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {overall.expected > 0 ? `${((uncollected / overall.expected) * 100).toFixed(1)}% of allowed` : '—'}
            </Typography>
          </Box>
        </RichTooltip>
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
          Net Collection Rate by Month
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pl: 1 }}>
          Cash-basis over ERA-matched claims: insurance by ERA check month, patient collections by payment month.
        </Typography>
        {(report?.monthly.length ?? 0) === 0 ? (
          <Box sx={{ py: 5, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No monthly data in this window.
            </Typography>
          </Box>
        ) : (
          <Chart
            chartType="LineChart"
            width="100%"
            height="320px"
            data={trendData}
            options={{
              colors: reportPalette.netCollections.series,
              backgroundColor: 'transparent',
              legend: { position: 'right', textStyle: { fontSize: 12 } },
              chartArea: { width: '80%', height: '75%' },
              vAxis: { format: "#'%'", viewWindow: { min: 0 } },
              pointSize: 5,
              interpolateNulls: false,
              series: { 2: { lineDashStyle: [4, 4] } },
            }}
          />
        )}
      </Box>

      <Typography variant="h5" color="primary.dark" fontWeight={600} sx={{ mb: 1.5 }}>
        Net Collections by Payer
      </Typography>
      <DataGridPro
        autoHeight
        rows={report?.payerRows ?? []}
        getRowId={(row) => `${row.payerId}|${row.payerName}`}
        columns={[...payerColumns, drilldownIndicatorColumn]}
        // pinned right so the clickability arrow stays visible when the grid scrolls horizontally
        pinnedColumns={{ right: [drilldownIndicatorColumn.field] }}
        loading={loading}
        disableRowSelectionOnClick
        disableColumnMenu
        hideFooter
        onRowClick={(gridRow) => {
          const row = gridRow.row as NetCollectionsPayerRow;
          setDrilldown({
            title: `${row.payerName} — ERAs`,
            payerId: row.payerId || 'none',
            window: {
              ...(dateFrom ? { dateFrom } : {}),
              ...(dateTo ? { dateTo } : {}),
            },
          });
        }}
        sx={dataGridSx}
        slots={dataGridSlots()}
      />

      <PayerErasDrawer criteria={drilldown} onClose={() => setDrilldown(null)} />
    </Box>
  );
}
