import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { Alert, Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { ReactElement, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Chart } from 'react-google-charts';
import { useNavigate } from 'react-router-dom';
import { ReportDateWindowParams } from 'utils/lib/types/data/billing/billing.schemas';
import {
  GetBillingNetCollectionsReportResponse,
  NetCollectionsBucket,
  NetCollectionsPayerRow,
} from 'utils/lib/types/data/billing/billing.types';
import { formatCurrency } from 'utils/lib/utils/convert';
import { getBillingNetCollectionsReport } from '../api/api';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { ReportStatusBar, sameWindow, windowParamsOf } from '../components/ReportStatusBar';
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

// stat card with the formula (and its substituted values) as the hover tooltip
function RateCard({
  label,
  bucket,
  formula,
  substitution,
}: {
  label: string;
  bucket: NetCollectionsBucket;
  formula: string;
  substitution: ReactNode;
}): ReactElement {
  const rate = rateOf(bucket);
  return (
    <Tooltip
      title={
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" component="div">
            {formula}
          </Typography>
          <Typography variant="caption" component="div" sx={{ opacity: 0.85 }}>
            {substitution}
          </Typography>
        </Box>
      }
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
    </Tooltip>
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
          formula="(insurance paid + patient collected) / allowed"
          substitution={`(${formatCurrency(insurance.collected)} + ${formatCurrency(
            patient.collected
          )}) / ${formatCurrency(overall.expected)}`}
        />
        <RateCard
          label="Insurance NCR"
          bucket={insurance}
          formula="insurance paid / (allowed − patient responsibility)"
          substitution={`${formatCurrency(insurance.collected)} / (${formatCurrency(
            overall.expected
          )} − ${formatCurrency(patient.expected)})`}
        />
        <RateCard
          label="Patient NCR"
          bucket={patient}
          formula="patient collected (net of refunds) / patient responsibility"
          substitution={`${formatCurrency(patient.collected)} / ${formatCurrency(patient.expected)}`}
        />
        <Tooltip
          title={
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" component="div">
                allowed − insurance paid − patient collected
              </Typography>
              <Typography variant="caption" component="div" sx={{ opacity: 0.85 }}>
                {`${formatCurrency(overall.expected)} − ${formatCurrency(insurance.collected)} − ${formatCurrency(
                  patient.collected
                )}`}
              </Typography>
            </Box>
          }
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
        </Tooltip>
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
          Cash-basis: insurance by ERA check month, patient collections by payment month.
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
        columns={payerColumns}
        loading={loading}
        disableRowSelectionOnClick
        disableColumnMenu
        hideFooter
        // rows have no drilldown (yet)
        sx={{ ...dataGridSx, '& .MuiDataGrid-row': { cursor: 'default' } }}
        slots={dataGridSlots()}
      />
    </Box>
  );
}
