import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Box,
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
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import React, { ReactElement, useState } from 'react';
import { Link } from 'react-router-dom';
import { OutreachTaskSummary } from 'src/rcm/state/scheduled-outreach-config/scheduled-outreach-config.api';
import { useListOutreachTasksQuery } from 'src/rcm/state/scheduled-outreach-config/scheduled-outreach-config.queries';

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'draft,requested,in-progress,on-hold', label: 'Pending (all)' },
  { value: 'draft', label: 'Pending' },
  { value: 'requested', label: 'Requested' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'draft,requested,in-progress,completed,on-hold', label: 'All' },
];

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

// ── Component ──────────────────────────────────────────────────────────────

export default function OutreachTasksReport(): ReactElement {
  const [statusFilter, setStatusFilter] = useState('draft,requested,in-progress,on-hold');
  const { data, isLoading, error, refetch, isFetching } = useListOutreachTasksQuery({ status: statusFilter });

  const handleStatusChange = (event: SelectChangeEvent): void => {
    setStatusFilter(event.target.value);
  };

  if (error) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error">Failed to load outreach tasks: {error.message}</Alert>
      </Box>
    );
  }

  const tasks = data?.tasks || [];

  // Split into upcoming and past
  const upcomingTasks = tasks.filter(
    (t) => t.status !== 'completed' && t.status !== 'cancelled' && t.status !== 'failed'
  );
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">Outreach Tasks Report</Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Status Filter</InputLabel>
            <Select value={statusFilter} label="Status Filter" onChange={handleStatusChange}>
              {STATUS_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title="Refresh">
            <IconButton onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <CircularProgress size={20} /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : tasks.length === 0 ? (
        <Alert severity="info">No outreach tasks found matching the selected filter.</Alert>
      ) : (
        <Stack spacing={3}>
          {upcomingTasks.length > 0 && (
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Scheduled ({upcomingTasks.length})
              </Typography>
              <TaskTable tasks={upcomingTasks} />
            </Box>
          )}
          {completedTasks.length > 0 && (
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Completed ({completedTasks.length})
              </Typography>
              <TaskTable tasks={completedTasks} />
            </Box>
          )}
        </Stack>
      )}
    </Box>
  );
}

// ── Table Sub-component ────────────────────────────────────────────────────

function TaskTable({ tasks }: { tasks: OutreachTaskSummary[] }): ReactElement {
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
            <TableCell>Visit Date</TableCell>
            <TableCell>Based On</TableCell>
            <TableCell>Mediums</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tasks.map((task) => (
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
                {task.dueDateTime ? DateTime.fromISO(task.dueDateTime).toFormat('M/d/yyyy, h:mm a ZZZZ') : '—'}
              </TableCell>
              <TableCell>
                {task.authoredOn ? DateTime.fromISO(task.authoredOn).toFormat('M/d/yyyy, h:mm a ZZZZ') : '—'}
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
                {task.appointmentId ? (
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
                        <CopyableIdRow label="Appointment ID" value={task.appointmentId} />
                      </Box>
                    }
                  >
                    <Typography
                      variant="body2"
                      sx={{ cursor: 'default', color: 'text.secondary', fontSize: '0.75rem' }}
                    >
                      {task.focusReference.split('/')[0]}
                    </Typography>
                  </Tooltip>
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                    {task.focusReference.split('/')[0] || '—'}
                  </Typography>
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
            </TableRow>
          ))}
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
