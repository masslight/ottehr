import {
  ArrowBack as ArrowBackIcon,
  ArrowDownward as ArrowDownwardIcon,
  ArrowUpward as ArrowUpwardIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { Alert, Box, Button, ButtonBase, CircularProgress, Drawer, IconButton, Stack, Typography } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { ReportDateWindowParams } from 'utils/lib/types/data/billing/billing.schemas';
import { BillingClaimItem, GetBillingPipelineReportResponse } from 'utils/lib/types/data/billing/billing.types';
import {
  AR_STAGE,
  AR_STAGE_NONE,
  CLAIM_STATUS_FIELDS,
  CLAIM_STATUS_GROUPS,
  ClaimStatusFieldKey,
  formatAntCaseString,
} from 'utils/lib/types/data/billing/claim-status';
import { formatCurrency } from 'utils/lib/utils/convert';
import { getBillingPipelineReport, searchBillingClaims } from '../api/api';
import { CardActionHint } from '../components/CardActionHint';
import { ReportStatusBar, sameWindow, windowParamsOf } from '../components/ReportStatusBar';
import { useApiClients } from '../hooks/useAppClients';
import { useBillingReport } from '../hooks/useBillingReport';
import { useBillingReportHistory } from '../hooks/useBillingReportHistory';
import { otherColors } from '../themes/ottehr/colors';
import { reportPalette } from '../themes/ottehr/reportPalette';

const DRILLDOWN_PAGE_SIZE = 100;

const dayLabel = (day: string): string => (day ? DateTime.fromISO(day).toLocaleString(DateTime.DATE_MED) : '—');

const drilldownCellSx = {
  padding: '8px 14px',
  borderBottom: `1px solid ${otherColors.lightDivider}`,
  textAlign: 'right' as const,
  whiteSpace: 'nowrap' as const,
};
const drilldownHeadSx = { ...drilldownCellSx, fontWeight: 600, fontSize: 13, backgroundColor: reportPalette.mutedBg };

const AR_STAGE_FIELD = CLAIM_STATUS_FIELDS.find((field) => field.key === 'arStage');
const arStageLabel = (code: string): string =>
  AR_STAGE_FIELD?.options.find((option) => option.code === code)?.label ?? formatAntCaseString(code);

interface CellValue {
  claimCount: number;
  totalBilled: number;
}

const EMPTY_CELL: CellValue = { claimCount: 0, totalBilled: 0 };

// one color per status progression step (created/not-invoiced → … → finalized); 'No status' grey
const NO_STATUS_COLOR = reportPalette.pipeline.noStatus;
const STATUS_COLORS = reportPalette.pipeline.statusSeries;

const signedNumber = (diff: number): string =>
  `${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${Math.abs(diff).toLocaleString('en-US')}`;
const signedCurrency = (diff: number): string =>
  `${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${formatCurrency(Math.abs(diff))}`;
// bar rows: claims first, amount in parentheses
const countLabel = (cell: CellValue): string =>
  `${cell.claimCount.toLocaleString('en-US')} (${formatCurrency(cell.totalBilled)})`;
const deltaLabel = (cell: CellValue, prev: CellValue): string =>
  `${signedNumber(cell.claimCount - prev.claimCount)} (${signedCurrency(cell.totalBilled - prev.totalBilled)})`;
// headers: no parentheses
const headerLabel = (cell: CellValue): string =>
  `${cell.claimCount.toLocaleString('en-US')} claims · ${formatCurrency(cell.totalBilled)}`;
const headerDeltaLabel = (cell: CellValue, prev: CellValue): string =>
  `${signedNumber(cell.claimCount - prev.claimCount)} · ${signedCurrency(cell.totalBilled - prev.totalBilled)}`;

function StatusBarRow({
  label,
  color,
  cell,
  prevCell,
  maxCount,
  hasPrevious,
}: {
  label: string;
  color: string;
  cell: CellValue;
  prevCell: CellValue;
  maxCount: number;
  hasPrevious: boolean;
}): ReactElement {
  const pct = maxCount > 0 ? (cell.claimCount / maxCount) * 100 : 0;
  const prevPct = maxCount > 0 ? (prevCell.claimCount / maxCount) * 100 : 0;
  const countDiff = cell.claimCount - prevCell.claimCount;
  // three cells of the stage card's grid, so the numbers column aligns across rows
  return (
    <Box sx={{ display: 'contents' }}>
      <Typography variant="body2" color="text.secondary" noWrap sx={{ textAlign: 'right', pt: '1px' }}>
        {label}
      </Typography>
      <Box sx={{ minWidth: 0, pt: '2px' }}>
        <Box
          sx={{
            height: 10,
            borderRadius: 0.5,
            bgcolor: color,
            width: `${pct}%`,
            minWidth: cell.claimCount > 0 ? 4 : 0,
          }}
        />
        {hasPrevious && (
          <Box
            sx={{
              height: 6,
              mt: 0.5,
              borderRadius: 0.5,
              bgcolor: otherColors.lightDivider,
              width: `${prevPct}%`,
              minWidth: prevCell.claimCount > 0 ? 4 : 0,
            }}
          />
        )}
      </Box>
      <Box>
        <Typography variant="body2" fontWeight={600} color="primary.dark" noWrap>
          {countLabel(cell)}
        </Typography>
        {hasPrevious && (
          <Stack direction="row" alignItems="center" gap={0.25} sx={{ mt: 0.25 }}>
            {countDiff > 0 && <ArrowUpwardIcon sx={{ fontSize: 13, color: 'success.main' }} />}
            {countDiff < 0 && <ArrowDownwardIcon sx={{ fontSize: 13, color: 'error.main' }} />}
            <Typography variant="caption" color="text.secondary">
              {deltaLabel(cell, prevCell)}
            </Typography>
          </Stack>
        )}
      </Box>
    </Box>
  );
}

interface StageDrilldown {
  title: string;
  // AR_STAGE code, or AR_STAGE_NONE for claims without a stage
  arStage: string;
  statusFieldKey?: ClaimStatusFieldKey;
  // status tag value to narrow by (e.g. adjudication 'denied')
  status?: string;
  // only claims last updated on/before this ISO timestamp
  updatedBefore?: string;
  // claim created-date window matching the report filter
  createdFrom?: string;
  createdTo?: string;
}

function StageDrilldownDrawer({
  criteria,
  onClose,
}: {
  criteria: StageDrilldown | null;
  onClose: () => void;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [claims, setClaims] = useState<BillingClaimItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusField = criteria?.statusFieldKey
    ? CLAIM_STATUS_FIELDS.find((field) => field.key === criteria.statusFieldKey)
    : undefined;
  const statusLabel = (claim: BillingClaimItem): string => {
    const code = criteria?.statusFieldKey ? claim.statuses[criteria.statusFieldKey] : '';
    if (!code) return '—';
    return statusField?.options.find((option) => option.code === code)?.label ?? formatAntCaseString(code);
  };

  const fetchPage = useCallback(
    async (drilldown: StageDrilldown, offset: number): Promise<void> => {
      if (!oystehrZambda) return;
      setLoading(true);
      setError(null);
      try {
        const page = await searchBillingClaims(oystehrZambda, {
          arStage: drilldown.arStage,
          offset,
          pageSize: DRILLDOWN_PAGE_SIZE,
          ...(drilldown.status ? { status: drilldown.status } : {}),
          ...(drilldown.updatedBefore ? { updatedBefore: drilldown.updatedBefore } : {}),
          ...(drilldown.createdFrom ? { createdFrom: drilldown.createdFrom } : {}),
          ...(drilldown.createdTo ? { createdTo: drilldown.createdTo } : {}),
        });
        setClaims((prev) => (offset === 0 ? page.claims : [...prev, ...page.claims]));
        setTotal(page.total);
      } catch (err) {
        setError(getApiError({ error: err, defaultError: 'Failed to load claims' }));
      } finally {
        setLoading(false);
      }
    },
    [oystehrZambda]
  );

  useEffect(() => {
    if (!criteria) return;
    setClaims([]);
    setTotal(0);
    void fetchPage(criteria, 0);
  }, [criteria, fetchPage]);

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
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {total.toLocaleString('en-US')} claims
          </Typography>
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
        {loading && claims.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : claims.length === 0 ? (
          !error && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No claims in this stage.
            </Typography>
          )
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ ...drilldownHeadSx, textAlign: 'left' }}>Patient</th>
                  <th style={{ ...drilldownHeadSx, textAlign: 'left' }}>Date of Service</th>
                  <th style={drilldownHeadSx}>Billed</th>
                  <th style={{ ...drilldownHeadSx, textAlign: 'left' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => (
                  <tr
                    key={claim.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => window.open(`/claims/${claim.id}`, '_blank', 'noopener')}
                  >
                    <td style={{ ...drilldownCellSx, textAlign: 'left', fontWeight: 500 }}>
                      <a
                        href={`/claims/${claim.id}`}
                        target="_blank"
                        rel="noopener"
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: 'inherit', textDecoration: 'none' }}
                      >
                        {claim.patientName || '—'}
                      </a>
                    </td>
                    <td style={{ ...drilldownCellSx, textAlign: 'left' }}>{dayLabel(claim.serviceDate)}</td>
                    <td style={{ ...drilldownCellSx, fontWeight: 600 }}>{formatCurrency(claim.billed)}</td>
                    <td style={{ ...drilldownCellSx, textAlign: 'left' }}>{statusLabel(claim)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {claims.length < total && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={loading || !criteria}
                  onClick={() => criteria && void fetchPage(criteria, claims.length)}
                >
                  {loading
                    ? 'Loading…'
                    : `Load more (${claims.length.toLocaleString('en-US')} of ${total.toLocaleString('en-US')})`}
                </Button>
              </Box>
            )}
          </>
        )}
      </Box>
    </Drawer>
  );
}

function StatCard({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <Box
      sx={{
        flex: 1,
        bgcolor: 'background.paper',
        border: `1px solid ${otherColors.lightDivider}`,
        borderRadius: 2,
        px: 2.5,
        py: 2,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" color="primary.dark" fontWeight={600} sx={{ mt: 0.5 }}>
        {value}
      </Typography>
    </Box>
  );
}

export default function PipelineReport(): ReactElement {
  const navigate = useNavigate();

  const [drilldown, setDrilldown] = useState<StageDrilldown | null>(null);
  const { entries: history, reload: reloadHistory } = useBillingReportHistory('pipeline');
  // null until the latest cached run (or the empty state) is adopted from history
  const [range, setRange] = useState<ReportDateWindowParams | null>(null);
  useEffect(() => {
    if (history) setRange((current) => current ?? windowParamsOf(history[0]?.params));
  }, [history]);
  const { dateFrom, dateTo } = range ?? {};

  const { report, status, loading, error, clearError, refresh, refreshNext } =
    useBillingReport<GetBillingPipelineReportResponse>({
      fetch: useCallback(
        (client: Oystehr, refresh?: boolean) => getBillingPipelineReport(client, range ?? {}, refresh),
        [range]
      ),
      errorMessage: 'Failed to load pipeline report',
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

  // count/billed lookup keyed by `${arStage}|${status}`
  const cellByKey = useMemo(() => {
    const map = new Map<string, { claimCount: number; totalBilled: number }>();
    for (const row of report?.rows ?? []) {
      map.set(`${row.arStage}|${row.status}`, { claimCount: row.claimCount, totalBilled: row.totalBilled });
    }
    return map;
  }, [report]);

  const stageTotals = useMemo(() => {
    const map = new Map<string, { claimCount: number; totalBilled: number }>();
    for (const row of report?.rows ?? []) {
      const current = map.get(row.arStage) ?? { claimCount: 0, totalBilled: 0 };
      current.claimCount += row.claimCount;
      current.totalBilled += row.totalBilled;
      map.set(row.arStage, current);
    }
    return map;
  }, [report]);

  const prevCellByKey = useMemo(() => {
    const map = new Map<string, CellValue>();
    for (const row of report?.previous?.rows ?? []) {
      map.set(`${row.arStage}|${row.status}`, { claimCount: row.claimCount, totalBilled: row.totalBilled });
    }
    return map;
  }, [report]);

  const prevStageTotals = useMemo(() => {
    const map = new Map<string, CellValue>();
    for (const row of report?.previous?.rows ?? []) {
      const current = map.get(row.arStage) ?? { claimCount: 0, totalBilled: 0 };
      current.claimCount += row.claimCount;
      current.totalBilled += row.totalBilled;
      map.set(row.arStage, current);
    }
    return map;
  }, [report]);

  const hasPrevious = !!report?.previous;
  const previousDateLabel = report?.previous ? dayLabel(report.previous.snapshotDate) : '';

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
            Pipeline Report
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
            rangeLabel: 'Claim Created Range',
          }}
        />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} gap={2} mb={2.5}>
        <StatCard label="Total Claims" value={(report?.totals.claims ?? 0).toLocaleString('en-US')} />
        <StatCard label="Total Billed" value={formatCurrency(report?.totals.totalBilled ?? 0)} />
        <Box
          component={ButtonBase}
          focusRipple
          onClick={() =>
            setDrilldown({
              title: 'No AR Stage Claims',
              arStage: AR_STAGE_NONE,
              ...(dateFrom ? { createdFrom: dateFrom } : {}),
              ...(dateTo ? { createdTo: dateTo } : {}),
            })
          }
          sx={{
            flex: 1,
            display: 'block',
            textAlign: 'left',
            position: 'relative',
            bgcolor: 'background.paper',
            border: `1px solid ${otherColors.lightDivider}`,
            borderRadius: 2,
            px: 2.5,
            py: 2,
            cursor: 'pointer',
            '&:hover': { bgcolor: otherColors.apptHover },
            '&:hover .card-action-hint': { color: 'primary.main' },
          }}
        >
          <CardActionHint kind="drilldown" />
          <Typography variant="body2" color="text.secondary">
            No AR Stage
          </Typography>
          <Typography variant="h5" color="primary.dark" fontWeight={600} sx={{ mt: 0.5 }}>
            {headerLabel(stageTotals.get('') ?? EMPTY_CELL)}
          </Typography>
          {hasPrevious && (
            <Typography variant="caption" color="text.secondary">
              {headerDeltaLabel(stageTotals.get('') ?? EMPTY_CELL, prevStageTotals.get('') ?? EMPTY_CELL)} since{' '}
              {previousDateLabel}
            </Typography>
          )}
        </Box>
      </Stack>

      <Stack direction={{ xs: 'column', lg: 'row' }} gap={2.5} alignItems="stretch">
        {CLAIM_STATUS_GROUPS.map((group) => {
          const statusField = CLAIM_STATUS_FIELDS.find((field) => field.key === group.primaryFieldKey);
          const stageTotal = stageTotals.get(group.arStageCode) ?? EMPTY_CELL;
          const prevStageTotal = prevStageTotals.get(group.arStageCode) ?? EMPTY_CELL;
          const options = [{ code: '', label: 'No status' }, ...(statusField?.options ?? [])].filter(
            (option) =>
              option.code !== '' ||
              (cellByKey.get(`${group.arStageCode}|`)?.claimCount ?? 0) > 0 ||
              (prevCellByKey.get(`${group.arStageCode}|`)?.claimCount ?? 0) > 0
          );
          const maxCount = Math.max(
            1,
            ...options.map((option) =>
              Math.max(
                cellByKey.get(`${group.arStageCode}|${option.code}`)?.claimCount ?? 0,
                prevCellByKey.get(`${group.arStageCode}|${option.code}`)?.claimCount ?? 0
              )
            )
          );
          return (
            <Box
              key={group.key}
              component={ButtonBase}
              focusRipple
              onClick={() =>
                setDrilldown({
                  title: `${arStageLabel(group.arStageCode)} Claims`,
                  arStage: group.arStageCode,
                  statusFieldKey: group.primaryFieldKey,
                  ...(dateFrom ? { createdFrom: dateFrom } : {}),
                  ...(dateTo ? { createdTo: dateTo } : {}),
                })
              }
              sx={{
                flex: 1,
                minWidth: 0,
                display: 'block',
                textAlign: 'left',
                position: 'relative',
                bgcolor: 'background.paper',
                border: `1px solid ${otherColors.lightDivider}`,
                borderRadius: 2,
                px: 3,
                py: 2.5,
                cursor: 'pointer',
                '&:hover': { bgcolor: otherColors.apptHover },
                '&:hover .card-action-hint': { color: 'primary.main' },
              }}
            >
              <CardActionHint kind="drilldown" />
              <Box mb={2}>
                <Typography variant="h6" color="primary.dark" fontWeight={600}>
                  {arStageLabel(group.arStageCode)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {headerLabel(stageTotal)}
                  {hasPrevious && ` · ${headerDeltaLabel(stageTotal, prevStageTotal)} since ${previousDateLabel}`}
                </Typography>
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  // numbers column auto-sizes to its widest row and sits flush right
                  gridTemplateColumns: '110px minmax(0, 1fr) max-content',
                  columnGap: 1.5,
                  rowGap: 1.25,
                  alignItems: 'start',
                }}
              >
                {options.map((option) => (
                  <StatusBarRow
                    key={option.code || 'none'}
                    label={option.label}
                    color={
                      option.code === ''
                        ? NO_STATUS_COLOR
                        : STATUS_COLORS[
                            Math.max(0, statusField?.options.findIndex((o) => o.code === option.code) ?? 0) %
                              STATUS_COLORS.length
                          ]
                    }
                    cell={cellByKey.get(`${group.arStageCode}|${option.code}`) ?? EMPTY_CELL}
                    prevCell={prevCellByKey.get(`${group.arStageCode}|${option.code}`) ?? EMPTY_CELL}
                    maxCount={maxCount}
                    hasPrevious={hasPrevious}
                  />
                ))}
              </Box>
            </Box>
          );
        })}
      </Stack>

      <Box
        sx={{
          mt: 2.5,
          bgcolor: 'background.paper',
          border: `1px solid ${otherColors.lightDivider}`,
          borderRadius: 2,
          px: 3,
          py: 2.5,
        }}
      >
        <Typography variant="h6" color="primary.dark" fontWeight={600}>
          Insurance Payer AR — Needs Attention
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Denied, rejected, and stale claims currently in insurance AR. Click a bucket for the claims list.
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2} mt={2}>
          {(
            [
              {
                key: 'denied',
                label: 'Denied',
                cell: report?.insuranceBreakout.denied ?? EMPTY_CELL,
                drilldown: {
                  title: 'Insurance Payer AR — Denied Claims',
                  arStage: AR_STAGE.insurancePayer,
                  statusFieldKey: 'adjudicationStatus' as ClaimStatusFieldKey,
                  status: 'denied',
                },
              },
              {
                key: 'rejected',
                label: 'Rejected',
                cell: report?.insuranceBreakout.rejected ?? EMPTY_CELL,
                drilldown: {
                  title: 'Insurance Payer AR — Rejected Claims',
                  arStage: AR_STAGE.insurancePayer,
                  statusFieldKey: 'adjudicationStatus' as ClaimStatusFieldKey,
                  status: 'rejected',
                },
              },
              {
                key: 'stale',
                label: `Stale (no activity in ${report?.insuranceBreakout.staleDays ?? 30}+ days)`,
                cell: report?.insuranceBreakout.stale ?? EMPTY_CELL,
                drilldown: {
                  title: 'Insurance Payer AR — Stale Claims',
                  arStage: AR_STAGE.insurancePayer,
                  statusFieldKey: 'insuranceArStatus' as ClaimStatusFieldKey,
                  ...(report?.insuranceBreakout.staleBefore
                    ? { updatedBefore: report.insuranceBreakout.staleBefore }
                    : {}),
                },
              },
            ] as const
          ).map((bucket) => (
            <Box
              key={bucket.key}
              component={ButtonBase}
              focusRipple
              onClick={() =>
                setDrilldown({
                  ...bucket.drilldown,
                  ...(dateFrom ? { createdFrom: dateFrom } : {}),
                  ...(dateTo ? { createdTo: dateTo } : {}),
                })
              }
              sx={{
                flex: 1,
                display: 'block',
                textAlign: 'left',
                position: 'relative',
                border: `1px solid ${otherColors.lightDivider}`,
                borderRadius: 2,
                px: 2.5,
                py: 2,
                cursor: 'pointer',
                '&:hover': { bgcolor: otherColors.apptHover },
                '&:hover .card-action-hint': { color: 'primary.main' },
              }}
            >
              <CardActionHint kind="drilldown" />
              <Typography variant="body2" color="text.secondary">
                {bucket.label}
              </Typography>
              <Typography variant="h5" color="primary.dark" fontWeight={600} sx={{ mt: 0.5 }}>
                {headerLabel(bucket.cell)}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>

      <StageDrilldownDrawer criteria={drilldown} onClose={() => setDrilldown(null)} />
    </Box>
  );
}
