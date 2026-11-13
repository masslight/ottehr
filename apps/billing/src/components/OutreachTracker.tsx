import { Clear as ClearIcon, Refresh as RefreshIcon, Search as SearchIcon } from '@mui/icons-material';
import { Alert, Box, Button, Chip, InputAdornment, Link, MenuItem, Stack, TextField, Tooltip } from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import {
  ACTION_TYPE_LABELS,
  MEDIUM_LABELS,
  OUTREACH_TASK_STATUS_LABELS,
  TRIGGER_EVENT_LABELS,
} from 'utils/lib/helpers/rcm/scheduled-outreach-config';
import { ActionType, NotificationMedium, TriggerEvent } from 'utils/lib/types/api/scheduled-outreach.types';
import { BillingOutreachTask } from 'utils/lib/types/data/billing/billing.types';
import { formatCurrency } from 'utils/lib/utils/convert';
import { cancelOutreachTask, listOutreachTasks, retryOutreachTask } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { useDebounce } from '../hooks/useDebounce';
import { InvoiceStatusChip } from '../pages/InvoicesList';
import { formatDate, formatDateTime } from '../utils/format';
import { dataGridSlots, dataGridSx } from './BillingDataGrid';

const ALL_STATUSES = Object.keys(OUTREACH_TASK_STATUS_LABELS).join(',');

function taskNote(task: BillingOutreachTask): string {
  const unsent = (task.notificationResults ?? [])
    .filter((result) => !result.success)
    .map((result) => `${result.medium}: ${result.error ?? 'not sent'}`);
  return [task.errorMessage ?? task.chargeResult?.error ?? task.cancellationReason, ...unsent]
    .filter(Boolean)
    .join('; ');
}

function actionLabel(task: BillingOutreachTask): string {
  const label = ACTION_TYPE_LABELS[task.actionType as ActionType] ?? task.actionType;
  if (task.actionType !== 'send-notification' || !task.mediums) return label;
  const mediums = task.mediums.split(',').map((medium) => MEDIUM_LABELS[medium as NotificationMedium] ?? medium);
  return `${label} (${mediums.join(', ')})`;
}

function InvoiceCell({ invoice }: { invoice: NonNullable<BillingOutreachTask['invoice']> }): ReactElement {
  const amount = formatCurrency(invoice.amount);
  return (
    <Tooltip
      title={
        <>
          <div>Issued {formatDate(invoice.issueDate)}</div>
          <div>Due {formatDate(invoice.dueDate)}</div>
          {invoice.claimId && <div>Opens claim {invoice.claimId}</div>}
        </>
      }
    >
      <Stack direction="row" spacing={1} alignItems="center">
        {invoice.claimId ? (
          <Link component={RouterLink} to={`/claims/${invoice.claimId}`} underline="hover">
            {amount}
          </Link>
        ) : (
          amount
        )}
        <InvoiceStatusChip status={invoice.status} />
      </Stack>
    </Tooltip>
  );
}

export function OutreachTracker(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const { debounce, clear } = useDebounce();
  const [tasks, setTasks] = useState<BillingOutreachTask[]>([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [searchText, setSearchText] = useState('');
  const [status, setStatus] = useState('');
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (!oystehrZambda) return;
    let active = true;
    setLoading(true);
    setError(null);
    const { page, pageSize } = paginationModel;
    void listOutreachTasks(oystehrZambda, {
      status: status || ALL_STATUSES,
      searchText: searchText || undefined,
      offset: page * pageSize,
      pageSize,
    })
      .then((response) => {
        if (!active) return;
        setTasks(response.tasks);
        setTotal(response.totalCount);
      })
      .catch((err) => {
        if (!active) return;
        setError(getApiError({ error: err, defaultError: 'Failed to load outreach tasks' }));
        setTasks([]);
        setTotal(0);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [oystehrZambda, status, searchText, paginationModel, reloads]);

  const toFirstPage = (): void => setPaginationModel((model) => ({ ...model, page: 0 }));

  const run = async (action: typeof retryOutreachTask, taskId: string, done: string): Promise<void> => {
    if (!oystehrZambda) return;
    setBusyTaskId(taskId);
    try {
      await action(oystehrZambda, { taskId });
      enqueueSnackbar(done, { variant: 'success' });
      setReloads((value) => value + 1);
    } catch (err) {
      enqueueSnackbar(getApiError({ error: err, defaultError: 'Failed to update the outreach task' }), {
        variant: 'error',
      });
    } finally {
      setBusyTaskId(null);
    }
  };

  const columns: GridColDef<BillingOutreachTask>[] = [
    {
      field: 'patientName',
      headerName: 'Patient',
      flex: 1,
      minWidth: 120,
      renderCell: ({ row }) => (
        <Link component={RouterLink} to={`/patients/${row.patientId}`} underline="hover">
          {row.patientName}
        </Link>
      ),
    },
    {
      field: 'invoice',
      headerName: 'Invoice',
      width: 145,
      renderCell: ({ row }) => row.invoice && <InvoiceCell invoice={row.invoice} />,
    },
    { field: 'actionType', headerName: 'Action', width: 220, valueGetter: ({ row }) => actionLabel(row) },
    {
      field: 'triggerEvent',
      headerName: 'Trigger',
      width: 140,
      valueFormatter: ({ value }) => TRIGGER_EVENT_LABELS[value as TriggerEvent] ?? value,
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      renderCell: ({ row }) => (
        <Chip
          size="small"
          label={OUTREACH_TASK_STATUS_LABELS[row.status] ?? row.status}
          color={row.status === 'failed' ? 'error' : row.status === 'completed' ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'dueDateTime',
      headerName: 'Scheduled for',
      width: 175,
      valueFormatter: ({ value }) => formatDateTime(value),
    },
    {
      field: 'note',
      headerName: 'Note',
      flex: 1,
      minWidth: 120,
      valueGetter: ({ row }) => taskNote(row),
      renderCell: ({ value }) => (
        <Tooltip title={value}>
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {value}
          </Box>
        </Tooltip>
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 90,
      renderCell: ({ row }) =>
        row.status === 'failed' ? (
          <Button
            size="small"
            variant="contained"
            disabled={busyTaskId === row.id}
            onClick={() => void run(retryOutreachTask, row.id, 'Outreach task will run again')}
          >
            Retry
          </Button>
        ) : row.status === 'draft' || row.status === 'requested' ? (
          <Button
            size="small"
            variant="outlined"
            disabled={busyTaskId === row.id}
            onClick={() => void run(cancelOutreachTask, row.id, 'Outreach task cancelled')}
          >
            Cancel
          </Button>
        ) : null,
    },
  ];

  return (
    <Box>
      <TextField
        fullWidth
        size="small"
        placeholder="Search by patient name, patient ID or claim ID..."
        helperText="Names match from the start. Enter a full Billing patient ID or claim ID."
        value={searchInput}
        onChange={(event) => {
          const { value } = event.target;
          setSearchInput(value);
          debounce(() => {
            setSearchText(value.trim());
            toFirstPage();
          });
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            toFirstPage();
          }}
          SelectProps={{ displayEmpty: true }}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 220 }}
        >
          <MenuItem value="">All statuses</MenuItem>
          {Object.entries(OUTREACH_TASK_STATUS_LABELS).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        {(searchInput || status) && (
          <Button
            variant="text"
            size="small"
            startIcon={<ClearIcon />}
            onClick={() => {
              clear();
              setSearchInput('');
              setSearchText('');
              setStatus('');
              toFirstPage();
            }}
          >
            Clear filters
          </Button>
        )}
        <Button
          startIcon={<RefreshIcon />}
          disabled={loading}
          onClick={() => setReloads((value) => value + 1)}
          sx={{ ml: 'auto' }}
        >
          Refresh
        </Button>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <DataGridPro
        rows={tasks}
        columns={columns.map((column) => ({ ...column, sortable: false }))}
        loading={loading}
        rowCount={total}
        paginationMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        disableRowSelectionOnClick
        disableColumnMenu
        pinnedColumns={{ right: ['actions'] }}
        pageSizeOptions={[25, 50, 100]}
        slots={dataGridSlots()}
        pagination={true}
        sx={{ ...dataGridSx, '& .MuiDataGrid-row': { cursor: 'default' }, height: 'calc(100vh - 355px)' }}
      />
    </Box>
  );
}
