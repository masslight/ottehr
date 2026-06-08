import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import MailIcon from '@mui/icons-material/Mail';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReplayIcon from '@mui/icons-material/Replay';
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  Divider,
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
import { Communication } from 'fhir/r4b';
import { DateTime } from 'luxon';
import React, { ReactElement, useState } from 'react';
import { Link } from 'react-router-dom';
import { getConversation } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  OutreachActionDTO,
  OutreachTaskSummary,
} from 'src/rcm/state/scheduled-outreach-config/scheduled-outreach-config.api';
import {
  useCancelOutreachTaskMutation,
  useGetOutreachConfigQuery,
  useListOutreachTasksQuery,
  useRetryOutreachTaskMutation,
} from 'src/rcm/state/scheduled-outreach-config/scheduled-outreach-config.queries';
import { ConversationMessage } from 'utils';

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_FILTER_OPTIONS = [
  'draft',
  'requested',
  'in-progress',
  'on-hold',
  'completed',
  'failed',
  'cancelled',
] as const;
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
  failed: { background: '#B71C1C', color: '#FFFFFF' },
  cancelled: { background: '#FECDD2', color: '#B71C1C' },
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  'send-notification': 'Send Notification',
  'charge-card': 'Charge Card',
  'refer-to-collections': 'Refer to Collections',
  log: 'Log',
};

const ACTION_CHIP_COLORS: Record<string, string> = {
  'charge-card': '#e65100',
  'send-notification': '#2e7d32',
  'refer-to-collections': '#b71c1c',
  log: '#546e7a',
};

const ACTION_FILTER_LABELS: Record<string, string> = {
  'send-notification': 'Notification',
  'charge-card': 'Charge',
  'refer-to-collections': 'Collections',
  log: 'Log',
};

const MEDIUM_LABELS: Record<string, string> = {
  sms: 'SMS',
  email: 'Email',
  'paper-mail': 'Mail',
};

const MEDIUM_FILTER_LABELS: Record<string, string> = {
  sms: 'SMS',
  email: 'Email',
  'paper-mail': 'Mail',
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

const TRIGGER_EVENT_FILTER_OPTIONS = Object.keys(TRIGGER_EVENT_LABELS) as TriggerEventFilterValue[];
type TriggerEventFilterValue = keyof typeof TRIGGER_EVENT_LABELS;

type DateRangePreset =
  | 'today'
  | 'last7days'
  | 'last30days'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisQuarter'
  | 'lastQuarter'
  | 'custom';

const DATE_RANGE_OPTIONS: { value: DateRangePreset; label: string }[] = [
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

const ACTION_TYPE_FILTER_OPTIONS = Object.keys(ACTION_TYPE_LABELS) as ActionTypeFilterValue[];
type ActionTypeFilterValue = keyof typeof ACTION_TYPE_LABELS;

const MEDIUM_FILTER_OPTIONS = Object.keys(MEDIUM_LABELS) as MediumFilterValue[];
type MediumFilterValue = keyof typeof MEDIUM_LABELS;

export default function OutreachTasksReport(): ReactElement {
  const [selectedStatuses, setSelectedStatuses] = useState<StatusFilterValue[]>([...STATUS_FILTER_OPTIONS]);
  const [selectedActionTypes, setSelectedActionTypes] = useState<ActionTypeFilterValue[]>([]);
  const [selectedMediums, setSelectedMediums] = useState<MediumFilterValue[]>([]);
  const [selectedTriggerEvents, setSelectedTriggerEvents] = useState<TriggerEventFilterValue[]>([]);
  const [patientSearchInput, setPatientSearchInput] = useState('');
  const [patientSearchCommitted, setPatientSearchCommitted] = useState('');
  const [dueDatePreset, setDueDatePreset] = useState<DateRangePreset>('today');
  const [dueDateCustomStart, setDueDateCustomStart] = useState('');
  const [dueDateCustomEnd, setDueDateCustomEnd] = useState('');
  const [createdPreset, setCreatedPreset] = useState<DateRangePreset>('today');
  const [createdCustomStart, setCreatedCustomStart] = useState('');
  const [createdCustomEnd, setCreatedCustomEnd] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const cancelMutation = useCancelOutreachTaskMutation();
  const retryMutation = useRetryOutreachTaskMutation();

  const statusFilter = selectedStatuses.join(',');
  const actionTypeFilter = selectedActionTypes.length > 0 ? selectedActionTypes.join(',') : undefined;
  const mediumFilter = selectedMediums.length > 0 ? selectedMediums.join(',') : undefined;
  const triggerEventFilter = selectedTriggerEvents.length > 0 ? selectedTriggerEvents.join(',') : undefined;
  const patientSearchFilter = patientSearchCommitted || undefined;
  const dueRange = getDateRangeValues(dueDatePreset, dueDateCustomStart, dueDateCustomEnd);
  const createdRange = getDateRangeValues(createdPreset, createdCustomStart, createdCustomEnd);

  // Reset to first page when filters change
  React.useEffect(() => {
    setPage(0);
  }, [
    statusFilter,
    actionTypeFilter,
    mediumFilter,
    triggerEventFilter,
    patientSearchFilter,
    dueDatePreset,
    dueDateCustomStart,
    dueDateCustomEnd,
    createdPreset,
    createdCustomStart,
    createdCustomEnd,
  ]);

  const { data, isLoading, error, refetch, isFetching } = useListOutreachTasksQuery({
    status: statusFilter,
    actionType: actionTypeFilter,
    medium: mediumFilter,
    triggerEvent: triggerEventFilter,
    patientSearch: patientSearchFilter,
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
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap', rowGap: 1 }}>
        <Autocomplete
          multiple
          size="small"
          limitTags={5}
          options={[...STATUS_FILTER_OPTIONS]}
          getOptionLabel={(opt) => STATUS_DISPLAY[opt] || opt}
          value={selectedStatuses}
          onChange={(_, newValue) => setSelectedStatuses(newValue as StatusFilterValue[])}
          disableCloseOnSelect
          renderInput={(params) => <TextField {...params} label="Status" placeholder="Status" />}
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
          sx={{
            width: 560,
            '& .MuiInputBase-root': { height: 68, overflow: 'hidden', alignItems: 'flex-start', paddingTop: '4px' },
          }}
        />
        <Autocomplete
          multiple
          size="small"
          limitTags={3}
          options={ACTION_TYPE_FILTER_OPTIONS}
          getOptionLabel={(opt) => ACTION_FILTER_LABELS[opt] || opt}
          value={selectedActionTypes}
          onChange={(_, newValue) => setSelectedActionTypes(newValue as ActionTypeFilterValue[])}
          disableCloseOnSelect
          renderInput={(params) => <TextField {...params} label="Action" placeholder="Action" />}
          renderOption={(props, option, { selected }) => {
            const borderColor = ACTION_CHIP_COLORS[option] || '#757575';
            return (
              <li {...props}>
                <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
                <Chip
                  label={ACTION_FILTER_LABELS[option] || option}
                  size="small"
                  variant="outlined"
                  sx={{
                    borderRadius: '4px',
                    fontWeight: 500,
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    height: '20px',
                    borderColor,
                    color: borderColor,
                    backgroundColor: '#fff',
                  }}
                />
              </li>
            );
          }}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => {
              const borderColor = ACTION_CHIP_COLORS[option] || '#757575';
              return (
                <Chip
                  {...getTagProps({ index })}
                  key={option}
                  label={ACTION_FILTER_LABELS[option] || option}
                  size="small"
                  variant="outlined"
                  sx={{
                    borderRadius: '4px',
                    fontWeight: 500,
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    height: '22px',
                    borderColor,
                    color: borderColor,
                    backgroundColor: '#fff',
                    '& .MuiChip-deleteIcon': {
                      color: borderColor,
                      opacity: 0.7,
                      '&:hover': { opacity: 1 },
                    },
                  }}
                />
              );
            })
          }
          getLimitTagsText={(more) => `+${more} more`}
          sx={{
            width: 340,
            '& .MuiInputBase-root': { height: 68, overflow: 'hidden', alignItems: 'flex-start', paddingTop: '4px' },
          }}
        />
        <Autocomplete
          multiple
          size="small"
          limitTags={3}
          options={MEDIUM_FILTER_OPTIONS}
          getOptionLabel={(opt) => MEDIUM_FILTER_LABELS[opt] || opt}
          value={selectedMediums}
          onChange={(_, newValue) => setSelectedMediums(newValue as MediumFilterValue[])}
          disableCloseOnSelect
          renderInput={(params) => <TextField {...params} label="Medium" placeholder="Medium" />}
          renderOption={(props, option, { selected }) => {
            const borderColor = MEDIUM_CHIP_COLORS[option] || '#757575';
            return (
              <li {...props}>
                <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
                <Chip
                  label={MEDIUM_FILTER_LABELS[option] || option}
                  size="small"
                  variant="outlined"
                  sx={{
                    borderRadius: '4px',
                    fontWeight: 500,
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    height: '20px',
                    borderColor,
                    color: borderColor,
                    backgroundColor: '#fff',
                  }}
                />
              </li>
            );
          }}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => {
              const borderColor = MEDIUM_CHIP_COLORS[option] || '#757575';
              return (
                <Chip
                  {...getTagProps({ index })}
                  key={option}
                  label={MEDIUM_FILTER_LABELS[option] || option}
                  size="small"
                  variant="outlined"
                  sx={{
                    borderRadius: '4px',
                    fontWeight: 500,
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    height: '22px',
                    borderColor,
                    color: borderColor,
                    backgroundColor: '#fff',
                    '& .MuiChip-deleteIcon': {
                      color: borderColor,
                      opacity: 0.7,
                      '&:hover': { opacity: 1 },
                    },
                  }}
                />
              );
            })
          }
          getLimitTagsText={(more) => `+${more} more`}
          sx={{
            width: 300,
            '& .MuiInputBase-root': { height: 68, overflow: 'hidden', alignItems: 'flex-start', paddingTop: '4px' },
          }}
        />
      </Stack>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
        <TextField
          size="small"
          label="Patient"
          placeholder="UUID, ID, or name"
          value={patientSearchInput}
          onChange={(e) => setPatientSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPatientSearchCommitted(patientSearchInput);
            }
          }}
          onBlur={() => setPatientSearchCommitted(patientSearchInput)}
          sx={{ width: 220 }}
        />
        <Autocomplete
          multiple
          size="small"
          limitTags={3}
          options={TRIGGER_EVENT_FILTER_OPTIONS}
          getOptionLabel={(opt) => TRIGGER_EVENT_LABELS[opt] || opt}
          value={selectedTriggerEvents}
          onChange={(_, newValue) => setSelectedTriggerEvents(newValue as TriggerEventFilterValue[])}
          disableCloseOnSelect
          renderInput={(params) => <TextField {...params} label="Trigger" placeholder="Trigger" />}
          renderOption={(props, option, { selected }) => (
            <li {...props}>
              <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
              {TRIGGER_EVENT_LABELS[option] || option}
            </li>
          )}
          sx={{ width: 300 }}
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
          <TaskTable
            tasks={tasks}
            onCancel={(taskId) => cancelMutation.mutate({ taskId })}
            onRetry={(taskId) => retryMutation.mutate({ taskId })}
          />
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
  onRetry,
}: {
  tasks: OutreachTaskSummary[];
  onCancel?: (taskId: string) => void;
  onRetry?: (taskId: string) => void;
}): ReactElement {
  const { data: configData } = useGetOutreachConfigQuery();
  const actionsMap = React.useMemo(() => {
    const map = new Map<string, OutreachActionDTO>();
    if (configData?.actions) {
      for (const action of configData.actions) {
        map.set(action.id, action);
      }
    }
    return map;
  }, [configData]);

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
            <TableCell sx={{ width: 160 }} align="right">
              Controls
            </TableCell>
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
                          boxShadow: 3,
                          maxWidth: 420,
                          p: 0,
                        },
                      },
                    }}
                    title={<TaskStatusTooltipContent task={task} />}
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
                      {task.mediums.split(',').map((m) => {
                        const medium = m.trim();
                        const results =
                          task.actionType === 'send-notification'
                            ? task.executionResult || []
                            : task.notificationResults || [];
                        const result = results.find((r) => r.medium === medium);
                        const sent = result?.success === true;
                        const failed = result?.success === false;
                        const actionDef = actionsMap.get(task.actionId);
                        return (
                          <Tooltip
                            key={medium}
                            placement="bottom-start"
                            disableInteractive={false}
                            leaveDelay={200}
                            slotProps={{
                              tooltip: {
                                sx: {
                                  bgcolor: 'background.paper',
                                  color: 'text.primary',
                                  boxShadow: 3,
                                  maxWidth: 360,
                                  p: 0,
                                },
                              },
                            }}
                            title={
                              <MediumTooltipContent medium={medium} task={task} actionDef={actionDef} result={result} />
                            }
                          >
                            <Chip
                              label={MEDIUM_LABELS[medium] || medium}
                              size="small"
                              variant={sent ? 'filled' : 'outlined'}
                              icon={sent ? <CheckIcon sx={{ fontSize: 14 }} /> : undefined}
                              sx={{
                                bgcolor: sent ? MEDIUM_CHIP_COLORS[medium] || '#757575' : failed ? '#FFEBEE' : '#fff',
                                color: sent
                                  ? '#fff'
                                  : failed
                                  ? '#B71C1C'
                                  : MEDIUM_CHIP_COLORS[medium] || 'text.primary',
                                borderColor: failed ? '#B71C1C' : MEDIUM_CHIP_COLORS[medium] || 'divider',
                                fontWeight: 500,
                                fontSize: '0.75rem',
                                cursor: 'default',
                                '& .MuiChip-icon': { color: '#fff' },
                              }}
                            />
                          </Tooltip>
                        );
                      })}
                    </Box>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
                    <Tooltip title={task.status === 'failed' ? 'Retry task' : 'Task is not in failed state'}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={task.status !== 'failed' || !onRetry}
                          onClick={() => onRetry?.(task.id)}
                          sx={{
                            color: task.status === 'failed' ? 'warning.main' : undefined,
                          }}
                        >
                          <ReplayIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip
                      title={
                        task.status === 'draft' || task.status === 'requested'
                          ? 'Cancel task'
                          : 'Task cannot be cancelled'
                      }
                    >
                      <span>
                        <IconButton
                          size="small"
                          disabled={!(task.status === 'draft' || task.status === 'requested') || !onCancel}
                          onClick={() => onCancel?.(task.id)}
                          sx={{
                            color: task.status === 'draft' || task.status === 'requested' ? 'error.main' : undefined,
                          }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <SmsHistoryButton
                      patientId={task.patientId}
                      patientName={task.patientName}
                      disabled={!taskHasSms(task)}
                    />
                    <EmailHistoryButton
                      patientId={task.patientId}
                      patientName={task.patientName}
                      disabled={!taskHasEmail(task)}
                    />
                    <PaperMailHistoryButton
                      patientId={task.patientId}
                      patientName={task.patientName}
                      disabled={!taskHasPaperMail(task)}
                    />
                  </Stack>
                </TableCell>
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

// ── Rich Status Tooltip ────────────────────────────────────────────────────

function TaskStatusTooltipContent({ task }: { task: OutreachTaskSummary }): ReactElement {
  return (
    <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <CopyableIdRow label="Task ID" value={task.id} />

      {/* Cancellation reason for cancelled tasks */}
      {task.status === 'cancelled' && task.cancellationReason && (
        <Box sx={{ bgcolor: '#FFF3E0', borderRadius: 1, p: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#E65100' }}>
            Cancellation Reason
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: '#E65100', mt: 0.25 }}>
            {task.cancellationReason}
          </Typography>
        </Box>
      )}

      {/* Error message for failed tasks */}
      {task.status === 'failed' && task.errorMessage && (
        <Box sx={{ bgcolor: '#FFEBEE', borderRadius: 1, p: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#B71C1C' }}>
            Error
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: '#B71C1C', mt: 0.25 }}>
            {task.errorMessage}
          </Typography>
        </Box>
      )}

      {/* Charge card result */}
      {task.actionType === 'charge-card' && task.chargeResult && (
        <Box sx={{ bgcolor: task.chargeResult.success ? '#E8F5E9' : '#FFEBEE', borderRadius: 1, p: 1 }}>
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, color: task.chargeResult.success ? '#1B5E20' : '#B71C1C' }}
          >
            Charge {task.chargeResult.success ? 'Successful' : 'Failed'}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.5 }}>
            {task.chargeResult.amountCents != null && (
              <Typography variant="body2">Amount: ${(task.chargeResult.amountCents / 100).toFixed(2)}</Typography>
            )}
            {task.chargeResult.transactionId && (
              <CopyableIdRow label="Txn ID" value={task.chargeResult.transactionId} />
            )}
            {task.chargeResult.error && (
              <Typography variant="body2" sx={{ color: '#B71C1C' }}>
                {task.chargeResult.error}
              </Typography>
            )}
          </Box>
        </Box>
      )}

      {/* Charge card retry info */}
      {task.actionType === 'charge-card' && task.retryInfo && (
        <Box sx={{ bgcolor: '#FFF3E0', borderRadius: 1, p: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#E65100' }}>
            Retry Info
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.5 }}>
            <Typography variant="body2">
              Attempts: {task.retryInfo.attemptCount} / {task.retryInfo.maxAttempts}
            </Typography>
            <Typography variant="body2">
              Remaining: {Math.max(0, task.retryInfo.maxAttempts - task.retryInfo.attemptCount)}
            </Typography>
            {task.retryInfo.nextRetryDate && (
              <Typography variant="body2">
                Next retry: {DateTime.fromISO(task.retryInfo.nextRetryDate).toFormat('M/d/yyyy, h:mm a')}
              </Typography>
            )}
          </Box>
        </Box>
      )}

      {/* Notification results (from charge-card post-charge notifications) */}
      {task.notificationResults && task.notificationResults.length > 0 && (
        <Box sx={{ bgcolor: '#F3E5F5', borderRadius: 1, p: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#4A148C' }}>
            Post-Charge Notifications
          </Typography>
          {task.notificationResults.map((nr, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
              <Chip
                label={MEDIUM_LABELS[nr.medium] || nr.medium}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.7rem',
                  bgcolor: nr.success ? '#C8E6C9' : '#FFCDD2',
                  color: nr.success ? '#1B5E20' : '#B71C1C',
                }}
              />
              {nr.error && (
                <Typography variant="caption" sx={{ color: '#B71C1C' }}>
                  {nr.error}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Execution result (from send-notification tasks) */}
      {task.actionType === 'send-notification' && task.executionResult && task.executionResult.length > 0 && (
        <Box sx={{ bgcolor: '#E3F2FD', borderRadius: 1, p: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#0D47A1' }}>
            Notification Results
          </Typography>
          {task.executionResult.map((er, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
              <Chip
                label={MEDIUM_LABELS[er.medium] || er.medium}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.7rem',
                  bgcolor: er.success ? '#C8E6C9' : '#FFCDD2',
                  color: er.success ? '#1B5E20' : '#B71C1C',
                }}
              />
              {er.error && (
                <Typography variant="caption" sx={{ color: '#B71C1C' }}>
                  {er.error}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Completed / timing info */}
      {task.completedDateTime && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Completed: {DateTime.fromISO(task.completedDateTime).toFormat('M/d/yyyy h:mm a ZZZZ')}
        </Typography>
      )}
    </Box>
  );
}

// ── Medium Tooltip ─────────────────────────────────────────────────────────

const STATEMENT_TYPE_TOOLTIP_LABELS: Record<string, string> = {
  standard: 'Standard',
  'past-due': 'Past Due',
  'final-notice': 'Final Notice',
};

function MediumTooltipContent({
  medium,
  task,
  actionDef,
  result,
}: {
  medium: string;
  task: OutreachTaskSummary;
  actionDef?: OutreachActionDTO;
  result?: { medium: string; success: boolean; error?: string };
}): ReactElement {
  // Determine template content based on action type and medium
  let template: string | undefined;
  let statementType: string | undefined;
  let context: 'notification' | 'charge-success' | 'charge-failure' | undefined;

  if (actionDef) {
    if (actionDef.actionType === 'send-notification' && actionDef.sendNotificationConfig) {
      const cfg = actionDef.sendNotificationConfig;
      statementType = cfg.statementType;
      if (medium === 'sms') template = cfg.smsTemplate;
      else if (medium === 'email') template = cfg.emailTemplate;
      context = 'notification';
    } else if (actionDef.actionType === 'charge-card' && actionDef.chargeCardConfig) {
      const ccCfg = actionDef.chargeCardConfig;
      // Check if this medium is in onSuccess or onFailure
      if (ccCfg.onSuccess?.enabled && ccCfg.onSuccess.mediums.includes(medium as any)) {
        if (medium === 'sms') template = ccCfg.onSuccess.smsTemplate;
        else if (medium === 'email') template = ccCfg.onSuccess.emailTemplate;
        statementType = ccCfg.onSuccess.statementType;
        context = 'charge-success';
      }
      if (ccCfg.onFailure?.enabled && ccCfg.onFailure.mediums.includes(medium as any)) {
        if (medium === 'sms') template = template || ccCfg.onFailure.smsTemplate;
        else if (medium === 'email') template = template || ccCfg.onFailure.emailTemplate;
        if (!context) {
          statementType = ccCfg.onFailure.statementType;
          context = 'charge-failure';
        }
      }
    }
  }

  const triggerLabel = TRIGGER_EVENT_LABELS[task.triggerEvent] || task.triggerEvent;
  const triggerTiming = actionDef?.trigger
    ? `${actionDef.trigger.daysAfter} ${actionDef.trigger.timeUnit || 'days'} ${actionDef.trigger.direction || 'after'}`
    : undefined;

  return (
    <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 220 }}>
      {/* Medium header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          label={MEDIUM_LABELS[medium] || medium}
          size="small"
          sx={{
            height: 20,
            fontSize: '0.7rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            bgcolor: MEDIUM_CHIP_COLORS[medium] || '#757575',
            color: '#fff',
          }}
        />
        {result && (
          <Chip
            label={result.success ? 'Sent' : 'Failed'}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.65rem',
              fontWeight: 600,
              bgcolor: result.success ? '#C8E6C9' : '#FFCDD2',
              color: result.success ? '#1B5E20' : '#B71C1C',
            }}
          />
        )}
      </Box>

      {/* Trigger info */}
      <Box>
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block' }}>
          Trigger
        </Typography>
        <Typography variant="body2">
          {triggerLabel}
          {triggerTiming && (
            <Box component="span" sx={{ color: 'text.secondary', ml: 0.5 }}>
              ({triggerTiming})
            </Box>
          )}
        </Typography>
      </Box>

      {/* Context for charge-card */}
      {context && context !== 'notification' && (
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block' }}>
            Notification Context
          </Typography>
          <Typography variant="body2">
            {context === 'charge-success' ? 'On successful charge' : 'On failed charge'}
          </Typography>
        </Box>
      )}

      {/* Statement type */}
      {statementType && (
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block' }}>
            Statement Type
          </Typography>
          <Typography variant="body2">{STATEMENT_TYPE_TOOLTIP_LABELS[statementType] || statementType}</Typography>
        </Box>
      )}

      {/* Template preview */}
      {template && (
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block' }}>
            Template
          </Typography>
          <Typography
            variant="body2"
            sx={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              bgcolor: '#F5F5F5',
              borderRadius: 0.5,
              p: 0.75,
              fontSize: '0.75rem',
              maxHeight: 120,
              overflow: 'auto',
              fontFamily: 'monospace',
            }}
          >
            {template.length > 200 ? `${template.slice(0, 200)}…` : template}
          </Typography>
        </Box>
      )}

      {/* Error detail */}
      {result && !result.success && result.error && (
        <Box sx={{ bgcolor: '#FFEBEE', borderRadius: 0.5, p: 0.75 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#B71C1C', display: 'block' }}>
            Error
          </Typography>
          <Typography variant="body2" sx={{ color: '#B71C1C', fontSize: '0.75rem' }}>
            {result.error}
          </Typography>
        </Box>
      )}

      {/* Action ID */}
      {!actionDef && (
        <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
          Action definition not found in config
        </Typography>
      )}
    </Box>
  );
}

// ── SMS History ────────────────────────────────────────────────────────────

function taskHasSms(task: OutreachTaskSummary): boolean {
  if (!task.mediums) return false;
  return task.mediums.split(',').some((m) => m.trim() === 'sms');
}

function taskHasEmail(task: OutreachTaskSummary): boolean {
  if (!task.mediums) return false;
  return task.mediums.split(',').some((m) => m.trim() === 'email');
}

function taskHasPaperMail(task: OutreachTaskSummary): boolean {
  if (!task.mediums) return false;
  return task.mediums.split(',').some((m) => m.trim() === 'paper-mail');
}

function SmsHistoryButton({
  patientId,
  patientName,
  disabled,
}: {
  patientId: string;
  patientName: string;
  disabled?: boolean;
}): ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip title={disabled ? 'No SMS medium' : 'View SMS history'}>
        <span>
          <IconButton
            size="small"
            disabled={disabled}
            onClick={() => setOpen(true)}
            sx={{
              width: 28,
              height: 28,
              borderRadius: '100%',
              bgcolor: disabled ? undefined : '#43a047',
              color: disabled ? undefined : '#fff',
              '&:hover': { bgcolor: disabled ? undefined : '#2e7d32' },
            }}
          >
            <ChatOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </span>
      </Tooltip>
      {open && <SmsHistoryDialog patientId={patientId} patientName={patientName} onClose={() => setOpen(false)} />}
    </>
  );
}

function SmsHistoryDialog({
  patientId,
  patientName,
  onClose,
}: {
  patientId: string;
  patientName: string;
  onClose: () => void;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [messages, setMessages] = React.useState<ConversationMessage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const timezone = DateTime.now().zoneName;

  React.useEffect(() => {
    if (!oystehrZambda) return;
    setLoading(true);
    getConversation(oystehrZambda, { patientId, timezone })
      .then((data) => {
        setMessages(data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load SMS history:', err);
        setError('Failed to load messages');
        setLoading(false);
      });
  }, [oystehrZambda, patientId, timezone]);

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <Box sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            SMS History — {patientName}
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
          Read-only view of SMS messages between the clinic and the patient.
        </Typography>
        <Divider sx={{ mb: 1.5 }} />
        <Box
          sx={{
            height: 380,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            px: 0.5,
          }}
        >
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : messages.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', mt: 4 }}>
              No SMS messages found for this patient.
            </Typography>
          ) : (
            messages.map((msg) => (
              <Box
                key={msg.id}
                sx={{
                  display: 'flex',
                  flexDirection: msg.isFromPatient ? 'row' : 'row-reverse',
                  gap: 1,
                  alignItems: 'flex-end',
                }}
              >
                <Avatar
                  sx={{
                    width: 28,
                    height: 28,
                    fontSize: '0.75rem',
                    bgcolor: msg.isFromPatient ? '#e0e0e0' : '#1976d2',
                  }}
                >
                  {msg.isFromPatient ? 'P' : 'C'}
                </Avatar>
                <Box
                  sx={{
                    maxWidth: '70%',
                    bgcolor: msg.isFromPatient ? '#f5f5f5' : '#e3f2fd',
                    borderRadius: 2,
                    p: 1,
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {msg.content}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.25 }}>
                    {msg.sentDay} {msg.sentTime}
                  </Typography>
                </Box>
              </Box>
            ))
          )}
        </Box>
      </Box>
    </Dialog>
  );
}

// ── Email History ──────────────────────────────────────────────────────────

function EmailHistoryButton({
  patientId,
  patientName,
  disabled,
}: {
  patientId: string;
  patientName: string;
  disabled?: boolean;
}): ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip title={disabled ? 'No email medium' : 'View email history'}>
        <span>
          <IconButton
            size="small"
            disabled={disabled}
            onClick={() => setOpen(true)}
            sx={{
              width: 28,
              height: 28,
              borderRadius: '100%',
              bgcolor: disabled ? undefined : '#1976d2',
              color: disabled ? undefined : '#fff',
              '&:hover': { bgcolor: disabled ? undefined : '#1565c0' },
            }}
          >
            <Box sx={{ position: 'relative', display: 'inline-flex', width: 16, height: 16 }}>
              <InsertDriveFileOutlinedIcon sx={{ fontSize: 16 }} />
              <Box
                component="span"
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: '9px',
                  fontWeight: 700,
                  lineHeight: 1,
                  mt: '1px',
                }}
              >
                e
              </Box>
            </Box>
          </IconButton>
        </span>
      </Tooltip>
      {open && <EmailHistoryDialog patientId={patientId} patientName={patientName} onClose={() => setOpen(false)} />}
    </>
  );
}

interface EmailRecord {
  id: string;
  content: string;
  sentDate: string;
  recipientEmail: string;
}

function EmailHistoryDialog({
  patientId,
  patientName,
  onClose,
}: {
  patientId: string;
  patientName: string;
  onClose: () => void;
}): ReactElement {
  const { oystehr } = useApiClients();
  const [emails, setEmails] = React.useState<EmailRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!oystehr) return;
    setLoading(true);
    oystehr.fhir
      .search<Communication>({
        resourceType: 'Communication',
        params: [
          { name: 'subject', value: `Patient/${patientId}` },
          { name: 'category', value: 'https://ottehr.com/CodeSystem/communication-category|outreach' },
          { name: 'medium', value: 'https://terminology.hl7.org/6.0.2/ValueSet-v3-ParticipationMode.html|EMAILWRIT' },
          { name: '_sort', value: '-sent' },
          { name: '_count', value: '50' },
        ],
      })
      .then((bundle) => {
        const results = bundle.unbundle();
        const records: EmailRecord[] = results.map((comm) => {
          const textPayload = comm.payload?.find((p) => p.contentString)?.contentString || '';
          const recipientDisplay = comm.recipient?.[0]?.display || '';
          const sent = comm.sent
            ? DateTime.fromISO(comm.sent).toFormat('M/d/yyyy h:mm a')
            : comm.meta?.lastUpdated
            ? DateTime.fromISO(comm.meta.lastUpdated).toFormat('M/d/yyyy h:mm a')
            : 'Unknown date';
          return { id: comm.id || '', content: textPayload, sentDate: sent, recipientEmail: recipientDisplay };
        });
        setEmails(records);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load email history:', err);
        setError('Failed to load email history');
        setLoading(false);
      });
  }, [oystehr, patientId]);

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <Box sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Email History — {patientName}
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
          Outreach emails sent to the patient.
        </Typography>
        <Divider sx={{ mb: 1.5 }} />
        <Box
          sx={{
            height: 380,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            px: 0.5,
          }}
        >
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : emails.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', mt: 4 }}>
              No outreach emails found for this patient.
            </Typography>
          ) : (
            emails.map((email) => (
              <Box
                key={email.id}
                sx={{
                  display: 'flex',
                  flexDirection: 'row-reverse',
                  gap: 1,
                  alignItems: 'flex-end',
                }}
              >
                <Avatar
                  sx={{
                    width: 28,
                    height: 28,
                    fontSize: '0.75rem',
                    bgcolor: '#1976d2',
                  }}
                >
                  C
                </Avatar>
                <Box
                  sx={{
                    maxWidth: '80%',
                    bgcolor: '#e3f2fd',
                    borderRadius: 2,
                    p: 1.5,
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {email.content}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                    {email.recipientEmail && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        To: {email.recipientEmail}
                      </Typography>
                    )}
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      {email.sentDate}
                    </Typography>
                  </Stack>
                </Box>
              </Box>
            ))
          )}
        </Box>
      </Box>
    </Dialog>
  );
}

// ── Paper Mail History ─────────────────────────────────────────────────────

function PaperMailHistoryButton({
  patientId,
  patientName,
  disabled,
}: {
  patientId: string;
  patientName: string;
  disabled?: boolean;
}): ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip title={disabled ? 'No paper mail medium' : 'View paper mail history'}>
        <span>
          <IconButton
            size="small"
            disabled={disabled}
            onClick={() => setOpen(true)}
            sx={{
              width: 28,
              height: 28,
              borderRadius: '100%',
              bgcolor: disabled ? undefined : '#6d4c41',
              color: disabled ? undefined : '#fff',
              '&:hover': { bgcolor: disabled ? undefined : '#5d4037' },
            }}
          >
            <Box sx={{ position: 'relative', display: 'inline-flex', width: 16, height: 16 }}>
              <DescriptionOutlinedIcon sx={{ fontSize: 16 }} />
              <MailIcon
                sx={{
                  position: 'absolute',
                  bottom: -2,
                  right: -3,
                  fontSize: 12,
                  bgcolor: disabled ? '#fff' : '#6d4c41',
                  color: disabled ? undefined : '#fff',
                  borderRadius: '2px',
                }}
              />
            </Box>
          </IconButton>
        </span>
      </Tooltip>
      {open && (
        <PaperMailHistoryDialog patientId={patientId} patientName={patientName} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

const STATEMENT_TYPE_LABELS: Record<string, string> = {
  standard: 'Standard',
  'past-due': 'Past Due',
  'final-notice': 'Final Notice',
};

interface PaperMailRecord {
  id: string;
  statementType: string;
  sentDate: string;
  description: string;
}

function PaperMailHistoryDialog({
  patientId,
  patientName,
  onClose,
}: {
  patientId: string;
  patientName: string;
  onClose: () => void;
}): ReactElement {
  const { oystehr } = useApiClients();
  const [records, setRecords] = React.useState<PaperMailRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!oystehr) return;
    setLoading(true);
    oystehr.fhir
      .search<Communication>({
        resourceType: 'Communication',
        params: [
          { name: 'subject', value: `Patient/${patientId}` },
          { name: 'medium', value: 'https://terminology.hl7.org/6.0.2/ValueSet-v3-ParticipationMode.html|MAILWRIT' },
          { name: '_sort', value: '-sent' },
          { name: '_count', value: '50' },
        ],
      })
      .then((bundle) => {
        const results = bundle.unbundle();
        const parsed: PaperMailRecord[] = results.map((comm) => {
          const description = comm.payload?.find((p) => p.contentString)?.contentString || '';
          const sent = comm.sent
            ? DateTime.fromISO(comm.sent).toFormat('M/d/yyyy h:mm a')
            : comm.meta?.lastUpdated
            ? DateTime.fromISO(comm.meta.lastUpdated).toFormat('M/d/yyyy h:mm a')
            : 'Unknown date';
          // Try to extract statement type from description or fall back
          let statementType = 'standard';
          const lowerDesc = description.toLowerCase();
          if (lowerDesc.includes('final notice') || lowerDesc.includes('final-notice')) {
            statementType = 'final-notice';
          } else if (lowerDesc.includes('past due') || lowerDesc.includes('past-due')) {
            statementType = 'past-due';
          }
          return { id: comm.id || '', statementType, sentDate: sent, description };
        });
        setRecords(parsed);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load paper mail history:', err);
        setError('Failed to load paper mail history');
        setLoading(false);
      });
  }, [oystehr, patientId]);

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <Box sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Paper Statements — {patientName}
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
          Mailed paper statements sent to the patient.
        </Typography>
        <Divider sx={{ mb: 1.5 }} />
        <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 120 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : records.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', mt: 4 }}>
              No paper statements found for this patient.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {records.map((record) => (
                <Paper key={record.id} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Chip
                      label={STATEMENT_TYPE_LABELS[record.statementType] || record.statementType}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        bgcolor:
                          record.statementType === 'final-notice'
                            ? '#ffebee'
                            : record.statementType === 'past-due'
                            ? '#fff3e0'
                            : '#e8f5e9',
                        color:
                          record.statementType === 'final-notice'
                            ? '#c62828'
                            : record.statementType === 'past-due'
                            ? '#e65100'
                            : '#2e7d32',
                      }}
                    />
                    <Typography variant="caption" sx={{ color: 'text.secondary', flexGrow: 1 }}>
                      {record.sentDate}
                    </Typography>
                  </Stack>
                  {record.description && (
                    <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary', fontSize: '0.8rem' }}>
                      {record.description}
                    </Typography>
                  )}
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
      </Box>
    </Dialog>
  );
}
