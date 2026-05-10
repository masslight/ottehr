import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Autocomplete,
  Box,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import React, { ReactElement, useState } from 'react';
import { Link } from 'react-router-dom';
import { OutreachTaskSummary } from 'src/rcm/state/scheduled-outreach-config/scheduled-outreach-config.api';
import {
  useCancelOutreachTaskMutation,
  useListOutreachTasksQuery,
} from 'src/rcm/state/scheduled-outreach-config/scheduled-outreach-config.queries';

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_FILTER_OPTIONS = ['draft', 'requested', 'in-progress', 'on-hold', 'completed', 'cancelled'] as const;
type StatusFilterValue = (typeof STATUS_FILTER_OPTIONS)[number];

const STATUS_DISPLAY: Record<string, string> = {
  draft: 'Pending',
  requested: 'Requested',
  'in-progress': 'In Progress',
  completed: 'Completed',
  'on-hold': 'On Hold',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

const STATUS_CHIP_STYLES: Record<string, { background: string; color: string }> = {
  draft: { background: '#EEEEEE', color: '#616161' },
  requested: { background: '#FFF3CD', color: '#7A5E00' },
  'in-progress': { background: '#BBDEFB', color: '#0D47A1' },
  completed: { background: '#C8E6C9', color: '#1B5E20' },
  'on-hold': { background: '#FFE0B2', color: '#E65100' },
  failed: { background: '#FECDD2', color: '#B71C1C' },
  cancelled: { background: '#FECDD2', color: '#B71C1C' },
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  'send-notification': 'Send Notification',
  'charge-card': 'Charge Card',
  'refer-to-collections': 'Refer to Collections',
};

const ACTION_CHIP_COLORS: Record<string, string> = {
  'charge-card': '#e65100',
  'send-notification': '#2e7d32',
  'refer-to-collections': '#b71c1c',
};

const MEDIUM_LABELS: Record<string, string> = {
  sms: 'SMS',
  email: 'Email',
  'paper-mail': 'Mail Statement',
};

const MEDIUM_CHIP_COLORS: Record<string, string> = {
  sms: '#43a047',
  email: '#0277bd',
  'paper-mail': '#4e342e',
};

const TRIGGER_EVENT_LABELS: Record<string, string> = {
  'discharge-time': 'Discharge Time',
  'date-of-visit': 'Visit Date',
  'invoice-issued': 'Invoice Issued',
  'invoice-due': 'Invoice Due',
  'patient-birthday': 'Patient Birthday',
};

type DateRangePreset =
  | 'all'
  | 'today'
  | 'last7days'
  | 'last30days'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisQuarter'
  | 'lastQuarter'
  | 'custom';

const DATE_RANGE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'thisQuarter', label: 'This Quarter' },
  { value: 'lastQuarter', label: 'Last Quarter' },
  { value: 'custom', label: 'Custom Range' },
];

function getDateRangeValues(
  preset: DateRangePreset,
  customStart: string,
  customEnd: string
): { from?: string; to?: string } {
  const now = DateTime.now();
  switch (preset) {
    case 'all':
      return {};
    case 'today':
      return { from: now.startOf('day').toISO() ?? undefined, to: now.endOf('day').toISO() ?? undefined };
    case 'last7days':
      return {
        from: now.minus({ days: 6 }).startOf('day').toISO() ?? undefined,
        to: now.endOf('day').toISO() ?? undefined,
      };
    case 'last30days':
      return {
        from: now.minus({ days: 29 }).startOf('day').toISO() ?? undefined,
        to: now.endOf('day').toISO() ?? undefined,
      };
    case 'thisMonth':
      return {
        from: now.startOf('month').toISO() ?? undefined,
        to: now.endOf('month').toISO() ?? undefined,
      };
    case 'lastMonth': {
      const lm = now.minus({ months: 1 });
      return { from: lm.startOf('month').toISO() ?? undefined, to: lm.endOf('month').toISO() ?? undefined };
    }
    case 'thisQuarter':
      return {
        from: now.startOf('quarter').toISO() ?? undefined,
        to: now.endOf('quarter').toISO() ?? undefined,
      };
    case 'lastQuarter': {
      const lq = now.minus({ quarters: 1 });
      return { from: lq.startOf('quarter').toISO() ?? undefined, to: lq.endOf('quarter').toISO() ?? undefined };
    }
    case 'custom': {
      if (!customStart && !customEnd) return {};
      return {
        from: customStart ? DateTime.fromISO(customStart).startOf('day').toISO() ?? undefined : undefined,
        to: customEnd ? DateTime.fromISO(customEnd).endOf('day').toISO() ?? undefined : undefined,
      };
    }
    default:
      return {};
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function OutreachTasksReport(): ReactElement {
  const [selectedStatuses, setSelectedStatuses] = useState<StatusFilterValue[]>([...STATUS_FILTER_OPTIONS]);
  const [dueDatePreset, setDueDatePreset] = useState<DateRangePreset>('all');
  const [dueDateCustomStart, setDueDateCustomStart] = useState('');
  const [dueDateCustomEnd, setDueDateCustomEnd] = useState('');
  const [createdPreset, setCreatedPreset] = useState<DateRangePreset>('all');
  const [createdCustomStart, setCreatedCustomStart] = useState('');
  const [createdCustomEnd, setCreatedCustomEnd] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const cancelMutation = useCancelOutreachTaskMutation();

  const statusFilter = selectedStatuses.join(',');
  const dueRange = getDateRangeValues(dueDatePreset, dueDateCustomStart, dueDateCustomEnd);
  const createdRange = getDateRangeValues(createdPreset, createdCustomStart, createdCustomEnd);

  // Reset to first page when filters change
  React.useEffect(() => {
    setPage(0);
  }, [
    statusFilter,
    dueDatePreset,
    dueDateCustomStart,
    dueDateCustomEnd,
    createdPreset,
    createdCustomStart,
    createdCustomEnd,
  ]);

  const { data, isLoading, error, refetch, isFetching } = useListOutreachTasksQuery({
    status: statusFilter,
    dueDateFrom: dueRange.from,
    dueDateTo: dueRange.to,
    createdFrom: createdRange.from,
    createdTo: createdRange.to,
    pageSize: rowsPerPage,
    offset: page * rowsPerPage,
  });

  if (error) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error">Failed to load outreach tasks: {error.message}</Alert>
      </Box>
    );
  }

  const tasks = data?.tasks || [];
  const totalCount = data?.totalCount ?? 0;

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
        <Autocomplete
          multiple
          size="small"
          limitTags={5}
          options={[...STATUS_FILTER_OPTIONS]}
          getOptionLabel={(opt) => STATUS_DISPLAY[opt] || opt}
          value={selectedStatuses}
          onChange={(_, newValue) => setSelectedStatuses(newValue as StatusFilterValue[])}
          disableCloseOnSelect
          renderInput={(params) => <TextField {...params} label="Filter by status" placeholder="Status" />}
          renderOption={(props, option, { selected }) => (
            <li {...props}>
              <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
              <Chip
                label={STATUS_DISPLAY[option] || option}
                size="small"
                sx={{
                  borderRadius: '4px',
                  border: 'none',
                  fontWeight: 500,
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  height: '20px',
                  ...(STATUS_CHIP_STYLES[option] || STATUS_CHIP_STYLES.draft),
                }}
              />
            </li>
          )}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => {
              const styles = STATUS_CHIP_STYLES[option] || STATUS_CHIP_STYLES.draft;
              return (
                <Chip
                  {...getTagProps({ index })}
                  key={option}
                  label={STATUS_DISPLAY[option] || option}
                  size="small"
                  sx={{
                    borderRadius: '4px',
                    border: 'none',
                    fontWeight: 500,
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    height: '22px',
                    ...styles,
                    '& .MuiChip-deleteIcon': {
                      color: styles.color,
                      opacity: 0.7,
                      '&:hover': { opacity: 1 },
                    },
                  }}
                />
              );
            })
          }
          getLimitTagsText={(more) => `+${more} more`}
          sx={{ width: 500 }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Due Date</InputLabel>
          <Select
            value={dueDatePreset}
            label="Due Date"
            onChange={(e: SelectChangeEvent) => setDueDatePreset(e.target.value as DateRangePreset)}
          >
            {DATE_RANGE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {dueDatePreset === 'custom' && (
          <>
            <TextField
              size="small"
              label="From"
              type="date"
              value={dueDateCustomStart}
              onChange={(e) => setDueDateCustomStart(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 155 }}
            />
            <TextField
              size="small"
              label="To"
              type="date"
              value={dueDateCustomEnd}
              onChange={(e) => setDueDateCustomEnd(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 155 }}
            />
          </>
        )}
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Created Date</InputLabel>
          <Select
            value={createdPreset}
            label="Created Date"
            onChange={(e: SelectChangeEvent) => setCreatedPreset(e.target.value as DateRangePreset)}
          >
            {DATE_RANGE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {createdPreset === 'custom' && (
          <>
            <TextField
              size="small"
              label="From"
              type="date"
              value={createdCustomStart}
              onChange={(e) => setCreatedCustomStart(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 155 }}
            />
            <TextField
              size="small"
              label="To"
              type="date"
              value={createdCustomEnd}
              onChange={(e) => setCreatedCustomEnd(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 155 }}
            />
          </>
        )}
        <Tooltip title="Refresh">
          <IconButton onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <CircularProgress size={20} /> : <RefreshIcon />}
          </IconButton>
        </Tooltip>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : tasks.length === 0 ? (
        <Alert severity="info">No outreach tasks found matching the selected filter.</Alert>
      ) : (
        <Box>
          <TaskTable tasks={tasks} onCancel={(taskId) => cancelMutation.mutate({ taskId })} />
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
        </Box>
      )}
    </Box>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isOverdue(task: OutreachTaskSummary): boolean {
  if (task.status === 'completed' || task.status === 'cancelled') return false;
  if (!task.dueDateTime) return false;
  return DateTime.fromISO(task.dueDateTime) < DateTime.now();
}

// ── Table Sub-component ────────────────────────────────────────────────────

function TaskTable({
  tasks,
  onCancel,
}: {
  tasks: OutreachTaskSummary[];
  onCancel?: (taskId: string) => void;
}): ReactElement {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Status</TableCell>
            <TableCell>Patient</TableCell>
            <TableCell>Action</TableCell>
            <TableCell>Trigger</TableCell>
            <TableCell>Due Date</TableCell>
            <TableCell>Created</TableCell>
            <TableCell>Completed</TableCell>
            <TableCell>Visit Date</TableCell>
            <TableCell>Mediums</TableCell>
            {onCancel && <TableCell sx={{ width: 60 }}>Actions</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {tasks.map((task) => {
            const overdue = isOverdue(task);
            return (
              <TableRow key={task.id} hover>
                <TableCell>
                  <Tooltip
                    placement="bottom-start"
                    disableInteractive={false}
                    leaveDelay={200}
                    slotProps={{
                      tooltip: {
                        sx: {
                          bgcolor: 'background.paper',
                          color: 'text.primary',
                          boxShadow: 2,
                          maxWidth: 'none',
                        },
                      },
                    }}
                    title={
                      <Box sx={{ p: 0.5 }}>
                        <CopyableIdRow label="Task ID" value={task.id} />
                      </Box>
                    }
                  >
                    <Chip
                      label={STATUS_DISPLAY[task.status] || task.status}
                      size="small"
                      variant="outlined"
                      sx={{
                        borderRadius: '4px',
                        border: 'none',
                        fontWeight: 500,
                        fontSize: '12px',
                        textTransform: 'uppercase',
                        height: '20px',
                        cursor: 'default',
                        ...(STATUS_CHIP_STYLES[task.status] || STATUS_CHIP_STYLES.draft),
                      }}
                    />
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Tooltip
                    placement="bottom-start"
                    disableInteractive={false}
                    leaveDelay={200}
                    slotProps={{
                      tooltip: {
                        sx: {
                          bgcolor: 'background.paper',
                          color: 'text.primary',
                          boxShadow: 2,
                          maxWidth: 'none',
                        },
                      },
                    }}
                    title={
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 0.5 }}>
                        {task.patientFriendlyId && <CopyableIdRow label="PID" value={task.patientFriendlyId} />}
                        <CopyableIdRow label="UUID" value={task.patientId} />
                      </Box>
                    }
                  >
                    <Box sx={{ display: 'inline-flex' }}>
                      <Link
                        to={`/patient/${task.patientId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: 'underline', color: '#1976d2' }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {task.patientName}
                        </Typography>
                      </Link>
                    </Box>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Chip
                    label={ACTION_TYPE_LABELS[task.actionType] || task.actionType}
                    size="small"
                    variant="outlined"
                    sx={{
                      bgcolor: '#fff',
                      color: ACTION_CHIP_COLORS[task.actionType] || 'text.primary',
                      borderColor: ACTION_CHIP_COLORS[task.actionType] || 'divider',
                      fontWeight: 500,
                    }}
                  />
                </TableCell>
                <TableCell>{TRIGGER_EVENT_LABELS[task.triggerEvent] || task.triggerEvent}</TableCell>
                <TableCell>
                  {task.dueDateTime ? (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Typography variant="body2">
                        {DateTime.fromISO(task.dueDateTime).toFormat('M/d/yyyy, h:mm a ZZZZ')}
                      </Typography>
                      {overdue && (
                        <Chip
                          label="OVERDUE"
                          size="small"
                          sx={{
                            borderRadius: '4px',
                            border: 'none',
                            fontWeight: 600,
                            fontSize: '10px',
                            textTransform: 'uppercase',
                            height: '18px',
                            background: '#FECDD2',
                            color: '#B71C1C',
                          }}
                        />
                      )}
                    </Stack>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>
                  {task.authoredOn ? DateTime.fromISO(task.authoredOn).toFormat('M/d/yyyy, h:mm a ZZZZ') : '—'}
                </TableCell>
                <TableCell>
                  {task.completedDateTime
                    ? DateTime.fromISO(task.completedDateTime).toFormat('M/d/yyyy, h:mm a ZZZZ')
                    : '—'}
                </TableCell>
                <TableCell>
                  {task.visitDate && task.appointmentId ? (
                    <Link
                      to={`/visit/${task.appointmentId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: 'underline', color: '#1976d2' }}
                    >
                      <Typography variant="body2">
                        {DateTime.fromISO(task.visitDate).toLocaleString(DateTime.DATE_SHORT)}
                      </Typography>
                    </Link>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>
                  {task.mediums ? (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {task.mediums.split(',').map((m) => (
                        <Chip
                          key={m}
                          label={MEDIUM_LABELS[m.trim()] || m.trim()}
                          size="small"
                          variant="outlined"
                          sx={{
                            bgcolor: '#fff',
                            color: MEDIUM_CHIP_COLORS[m.trim()] || 'text.primary',
                            borderColor: MEDIUM_CHIP_COLORS[m.trim()] || 'divider',
                            fontWeight: 500,
                            fontSize: '0.75rem',
                          }}
                        />
                      ))}
                    </Box>
                  ) : (
                    '—'
                  )}
                </TableCell>
                {onCancel && (
                  <TableCell>
                    {(task.status === 'draft' || task.status === 'requested') && (
                      <Tooltip title="Cancel task">
                        <IconButton size="small" onClick={() => onCancel(task.id)} sx={{ color: 'error.main' }}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ── Copyable ID Row ────────────────────────────────────────────────────────

function CopyableIdRow({ label, value }: { label: string; value: string }): ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }} onClick={handleCopy}>
      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
        <Box component="span" sx={{ fontWeight: 500, color: 'text.secondary' }}>
          {label}:
        </Box>{' '}
        {value}
      </Typography>
      <IconButton size="small" sx={{ p: 0.25 }} onClick={handleCopy}>
        {copied ? (
          <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />
        ) : (
          <ContentCopyIcon sx={{ fontSize: 14, color: 'primary.main' }} />
        )}
      </IconButton>
    </Box>
  );
}
