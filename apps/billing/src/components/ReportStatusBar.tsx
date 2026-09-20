import {
  History as HistoryIcon,
  KeyboardArrowDown as ArrowDownIcon,
  WarningAmberRounded as WarningIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Popover,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import { MouseEvent, ReactElement, useState } from 'react';
import { ReportDateWindowParams } from 'utils/lib/types/data/billing/billing.schemas';
import { BillingReportHistoryEntry, ReportRefreshStatus } from 'utils/lib/types/data/billing/billing.types';
import { DateRangeInput } from './DateInput';

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

export type DateRangePreset =
  | 'all-time'
  | 'previous-month'
  | 'current-month'
  | 'previous-quarter'
  | 'this-quarter'
  | 'year-to-date'
  | 'trailing-30-days'
  | 'trailing-12-months'
  | 'custom';

const DATE_RANGE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'all-time', label: 'All Time' },
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
    case 'all-time':
      return { from: '', to: '' };
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

// dateFrom/dateTo picked out of a history entry's params
export const windowParamsOf = (params: Record<string, unknown> | undefined): ReportDateWindowParams => ({
  ...(typeof params?.dateFrom === 'string' && params.dateFrom ? { dateFrom: params.dateFrom } : {}),
  ...(typeof params?.dateTo === 'string' && params.dateTo ? { dateTo: params.dateTo } : {}),
});

export const sameWindow = (
  a: ReportDateWindowParams | null | undefined,
  b: ReportDateWindowParams | null | undefined
): boolean => (a?.dateFrom ?? '') === (b?.dateFrom ?? '') && (a?.dateTo ?? '') === (b?.dateTo ?? '');

// history dropdown wiring provided by the page owning the report state
export interface ReportHistoryControls {
  entries: BillingReportHistoryEntry[] | undefined;
  // popover open — pages reload the list here
  onOpen?: () => void;
  // show a cached run (no recompute)
  onView: (params: ReportDateWindowParams) => void;
  // (re)compute a report for the given window
  onRun: (params: ReportDateWindowParams) => void;
  // kinds without a date window hide the range picker
  windowed?: boolean;
  // range picker label, e.g. 'Check Date Range'
  rangeLabel?: string;
}

const DEFAULT_PRESET: DateRangePreset = 'trailing-30-days';

function ReportHistoryButton({
  history,
  dateFrom,
  dateTo,
  runDisabled,
}: {
  history: ReportHistoryControls;
  dateFrom?: string;
  dateTo?: string;
  runDisabled: boolean;
}): ReactElement {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [preset, setPreset] = useState<DateRangePreset>(DEFAULT_PRESET);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const windowed = history.windowed !== false;

  const open = (event: MouseEvent<HTMLElement>): void => {
    history.onOpen?.();
    setAnchor(event.currentTarget);
  };
  const close = (): void => setAnchor(null);

  const runParams = (): ReportDateWindowParams => {
    if (!windowed) return {};
    const { from, to } = preset === 'custom' ? { from: customFrom, to: customTo } : presetRange(preset);
    return { ...(from ? { dateFrom: from } : {}), ...(to ? { dateTo: to } : {}) };
  };
  const customIncomplete = windowed && preset === 'custom' && !customFrom && !customTo;

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<HistoryIcon />}
        endIcon={<ArrowDownIcon />}
        onClick={open}
        data-testid="report-history-button"
      >
        History
      </Button>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ width: 360 }}>
          <Typography variant="subtitle2" sx={{ px: 2, pt: 1.5 }}>
            Report history
          </Typography>
          {history.entries === undefined ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={20} />
            </Box>
          ) : history.entries.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
              No reports generated yet.
            </Typography>
          ) : (
            <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
              {history.entries.map((entry: BillingReportHistoryEntry, index: number) => {
                const window = windowParamsOf(entry.params);
                return (
                  <ListItemButton
                    key={index}
                    selected={sameWindow(window, { dateFrom, dateTo })}
                    onClick={() => {
                      history.onView(window);
                      close();
                    }}
                  >
                    <ListItemText
                      primary={dateRangeLabel(window.dateFrom, window.dateTo) || 'All data'}
                      secondary={`Generated ${DateTime.fromISO(entry.generatedAt).toLocaleString(
                        DateTime.DATETIME_MED
                      )}${entry.sizeBytes ? ` · ${formatSize(entry.sizeBytes)}` : ''}`}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          )}
          <Divider />
          <Stack gap={1.25} sx={{ p: 2 }}>
            <Typography variant="subtitle2">Run a new report</Typography>
            {windowed && (
              <>
                <FormControl size="small" fullWidth>
                  <InputLabel>{history.rangeLabel ?? 'Date Range'}</InputLabel>
                  <Select
                    label={history.rangeLabel ?? 'Date Range'}
                    value={preset}
                    onChange={(e) => setPreset(e.target.value as DateRangePreset)}
                  >
                    {DATE_RANGE_PRESETS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {preset === 'custom' && (
                  <DateRangeInput
                    label={history.rangeLabel ?? 'Date Range'}
                    size="small"
                    fullWidth
                    valueFrom={customFrom}
                    valueTo={customTo}
                    onChange={(from, to) => {
                      setCustomFrom(from);
                      setCustomTo(to);
                    }}
                  />
                )}
              </>
            )}
            <Button
              variant="contained"
              size="small"
              disabled={runDisabled || customIncomplete}
              onClick={() => {
                history.onRun(runParams());
                close();
              }}
            >
              Run report
            </Button>
          </Stack>
        </Box>
      </Popover>
    </>
  );
}

// Report-header status line + history dropdown: pick a cached run to view, or run a new one.
export function ReportStatusBar({
  status,
  loading,
  dateFrom,
  dateTo,
  history,
}: {
  status: ReportRefreshStatus | undefined;
  loading: boolean;
  history: ReportHistoryControls;
  // the current view's date window, when the kind is parameterized by one
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
        <Stack direction="row" alignItems="center" gap={0.75} sx={{ maxWidth: 420 }}>
          <WarningIcon color="warning" sx={{ fontSize: 16 }} />
          <Tooltip title={status.error ?? ''}>
            <Typography variant="caption" color="warning.main" noWrap>
              {`Last refresh failed${status.error ? `: ${status.error}` : ''}`}
            </Typography>
          </Tooltip>
          <Button size="small" onClick={() => history.onRun(windowParamsOf({ dateFrom, dateTo }))}>
            Retry
          </Button>
        </Stack>
      ) : lastCompleted ? (
        <Tooltip title={lastCompleted.toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)}>
          <Typography variant="caption" color="text.disabled" noWrap>
            {`${rangePrefix}Updated ${lastCompleted.toRelative() ?? ''}${size}`}
          </Typography>
        </Tooltip>
      ) : (
        <Typography variant="caption" color="text.disabled" noWrap>
          {range || 'No report generated yet'}
        </Typography>
      )}
      <ReportHistoryButton history={history} dateFrom={dateFrom} dateTo={dateTo} runDisabled={loading || running} />
    </Stack>
  );
}
