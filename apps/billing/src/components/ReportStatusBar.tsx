import { Refresh as RefreshIcon, WarningAmberRounded as WarningIcon } from '@mui/icons-material';
import { Box, Button, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { ReactElement } from 'react';
import { ReportRefreshStatus } from 'utils/lib/types/data/billing/billing.types';

// Merges several statuses into the "most active" one (running > error > idle).
export function mergeReportStatuses(...statuses: (ReportRefreshStatus | undefined)[]): ReportRefreshStatus | undefined {
  const present = statuses.filter((status): status is ReportRefreshStatus => !!status);
  if (present.length === 0) return undefined;
  const running = present.find((status) => status.state === 'running');
  if (running) return running;
  const errored = present.find((status) => status.state === 'error');
  if (errored) return errored;
  // oldest completion is the honest "last updated" for the page as a whole; instants, not
  // string comparison — offsets/non-normalized ISO formats would sort wrong
  const completedMillis = (status: ReportRefreshStatus): number =>
    status.lastCompletedAt ? DateTime.fromISO(status.lastCompletedAt).toMillis() : Number.NEGATIVE_INFINITY;
  return present.reduce((oldest, status) => (completedMillis(status) < completedMillis(oldest) ? status : oldest));
}

const formatSize = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const dayLabel = (iso: string): string => DateTime.fromISO(iso).toLocaleString(DateTime.DATE_MED);

// "Jan 5 – Mar 31, 2026" / "Since Jan 5, 2026" / "Through Mar 31, 2026"; '' when unwindowed
export const dateRangeLabel = (dateFrom?: string, dateTo?: string): string => {
  if (dateFrom && dateTo) return `${dayLabel(dateFrom)} – ${dayLabel(dateTo)}`;
  if (dateFrom) return `Since ${dayLabel(dateFrom)}`;
  if (dateTo) return `Through ${dayLabel(dateTo)}`;
  return '';
};

// Report-header status line + refresh button: idle / running-with-live-progress / error+Retry.
export function ReportStatusBar({
  status,
  loading,
  onRefresh,
  dateFrom,
  dateTo,
}: {
  status: ReportRefreshStatus | undefined;
  loading: boolean;
  onRefresh: () => void;
  // the report's date window, when the kind is parameterized by one
  dateFrom?: string;
  dateTo?: string;
}): ReactElement {
  const running = status?.state === 'running';
  const lastCompleted = status?.lastCompletedAt ? DateTime.fromISO(status.lastCompletedAt) : undefined;
  const size = status?.cacheSizeBytes ? ` · ${formatSize(status.cacheSizeBytes)}` : '';
  const range = dateRangeLabel(dateFrom, dateTo);
  const rangePrefix = range ? `${range} · ` : '';

  return (
    <Stack direction="row" alignItems="center" gap={1.5}>
      {running ? (
        <Box sx={{ minWidth: 200, maxWidth: 360 }}>
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            {`Refreshing — ${status?.progress ?? 'queued'}`}
          </Typography>
          <LinearProgress sx={{ mt: 0.5, height: 3, borderRadius: 1 }} />
        </Box>
      ) : status?.state === 'error' ? (
        <Stack direction="row" alignItems="center" gap={0.75} sx={{ maxWidth: 360 }}>
          <WarningIcon color="warning" sx={{ fontSize: 16 }} />
          <Tooltip title={status.error ?? ''}>
            <Typography variant="caption" color="warning.main" noWrap>
              {`Last refresh failed${status.error ? `: ${status.error}` : ''}`}
            </Typography>
          </Tooltip>
        </Stack>
      ) : lastCompleted ? (
        <Tooltip title={lastCompleted.toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)}>
          <Typography variant="caption" color="text.disabled" noWrap>
            {`${rangePrefix}Updated ${lastCompleted.toRelative() ?? ''}${size}`}
          </Typography>
        </Tooltip>
      ) : range ? (
        <Typography variant="caption" color="text.disabled" noWrap>
          {range}
        </Typography>
      ) : null}
      <Button
        variant="outlined"
        size="small"
        startIcon={<RefreshIcon />}
        disabled={loading || running}
        onClick={onRefresh}
      >
        {status?.state === 'error' ? 'Retry' : 'Refresh'}
      </Button>
    </Stack>
  );
}
