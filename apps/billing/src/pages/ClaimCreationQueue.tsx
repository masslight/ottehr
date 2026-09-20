import { Refresh as RefreshIcon } from '@mui/icons-material';
import { Alert, Box, Button, Chip, Link, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { DataGridPro, GridColDef, GridPaginationModel } from '@mui/x-data-grid-pro';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useState } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { SearchBillingClaimTasksInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { BillingClaimTaskItem } from 'utils/lib/types/data/billing/billing.types';
import { formatAntCaseString } from 'utils/lib/types/data/billing/claim-status';
import { isValidUUID } from 'utils/lib/validation/helper';
import { retryBillingClaimTask, searchBillingClaimTasks } from '../api/api';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { CopyButton } from '../components/CopyButton';
import { DateRangeInput } from '../components/DateInput';
import { useApiClients } from '../hooks/useAppClients';

const EHR_URL = import.meta.env.VITE_APP_EHR_URL;
const QUERY_KEY = ['billing-claim-tasks'];
const formatDate = (value?: string): string =>
  value ? DateTime.fromISO(value).toLocaleString(DateTime.DATETIME_SHORT) : '—';

export function RetryTaskButton({ taskId }: { taskId: string }): ReactElement {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const retry = useMutation({
    mutationFn: () => retryBillingClaimTask(oystehrZambda!, { taskId }),
    onSuccess: async () => {
      enqueueSnackbar('Claim creation queued', { variant: 'success' });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error) => {
      enqueueSnackbar(getApiError({ error, defaultError: 'Failed to retry claim creation' }), { variant: 'error' });
    },
  });
  return (
    <Button size="small" disabled={!oystehrZambda || retry.isPending} onClick={() => retry.mutate()}>
      {retry.isPending ? 'Retrying…' : 'Retry'}
    </Button>
  );
}

const columns = (
  [
    {
      field: 'status',
      headerName: 'Status',
      width: 150,
      renderCell: ({ row }) => (
        <Chip
          size="small"
          label={formatAntCaseString(row.status)}
          color={row.status === 'failed' ? 'error' : row.status === 'completed' ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'encounterDate',
      headerName: 'Encounter',
      width: 220,
      renderCell: ({ row }) => (
        <Tooltip title={row.encounterId ? `Encounter ID: ${row.encounterId}` : ''}>
          <Stack direction="row" spacing={1} alignItems="center">
            {EHR_URL && row.appointmentId ? (
              <Link href={`${EHR_URL}/visit/${row.appointmentId}`} target="_blank" rel="noopener noreferrer">
                {formatDate(row.encounterDate)}
              </Link>
            ) : (
              formatDate(row.encounterDate)
            )}
            {row.encounterId && <CopyButton value={row.encounterId} label="encounter ID" />}
          </Stack>
        </Tooltip>
      ),
    },
    {
      field: 'patientName',
      headerName: 'Patient',
      minWidth: 180,
      flex: 1,
      renderCell: ({ row }) =>
        EHR_URL && row.patientId ? (
          <Link href={`${EHR_URL}/patient/${row.patientId}`} target="_blank" rel="noopener noreferrer">
            {row.patientName || row.patientId}
          </Link>
        ) : (
          row.patientName || row.patientId || '—'
        ),
    },
    {
      field: 'payerNames',
      headerName: 'Payers',
      minWidth: 180,
      flex: 1,
      valueGetter: ({ row }) => row.payerNames.join(', ') || '—',
    },
    { field: 'createdAt', headerName: 'Created', width: 170, valueFormatter: ({ value }) => formatDate(value) },
    { field: 'updatedAt', headerName: 'Updated', width: 170, valueFormatter: ({ value }) => formatDate(value) },
    {
      field: 'error',
      headerName: 'Error',
      minWidth: 260,
      flex: 1,
      renderCell: ({ row }) => (
        <Typography variant="body2" sx={{ whiteSpace: 'normal', py: 1 }}>
          {row.error || '—'}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 95,
      renderCell: ({ row }) => (row.status === 'failed' ? <RetryTaskButton taskId={row.id} /> : null),
    },
  ] satisfies GridColDef<BillingClaimTaskItem>[]
).map((column) => ({ ...column, sortable: false, filterable: false }));

export default function ClaimCreationQueue(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [pagination, setPagination] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [status, setStatus] = useState<BillingClaimTaskItem['status'] | ''>('');
  const [dates, setDates] = useState({ from: '', to: '' });
  const [patientText, setPatientText] = useState('');
  const [patient, setPatient] = useState('');
  const [payerText, setPayerText] = useState('');
  const [payerName, setPayerName] = useState('');
  const patientFilter = !patient
    ? {}
    : isValidUUID(patient)
    ? { patientId: patient }
    : /^\d+$/.test(patient)
    ? { patientIdentifier: patient }
    : { patientName: patient };
  const query = useQuery({
    queryKey: [...QUERY_KEY, status, dates, patient, payerName, pagination],
    enabled: !!oystehrZambda,
    queryFn: () =>
      searchBillingClaimTasks(oystehrZambda!, {
        status: status || undefined,
        createdFrom: dates.from || undefined,
        createdTo: dates.to || undefined,
        ...patientFilter,
        payerName: payerName || undefined,
        offset: pagination.page * pagination.pageSize,
        pageSize: pagination.pageSize,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: payerName ? 60_000 : 15_000,
  });
  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4">Claim Creation Queue</Typography>
        <Button
          startIcon={<RefreshIcon />}
          disabled={!oystehrZambda || query.isFetching}
          onClick={() => void query.refetch()}
        >
          Refresh
        </Button>
      </Stack>
      <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
        <Box
          component="form"
          sx={{ display: 'flex', gap: 1 }}
          onSubmit={(event) => {
            event.preventDefault();
            setPatient(patientText.trim());
            setPayerName(payerText.trim());
            setPagination((previous) => ({ ...previous, page: 0 }));
          }}
        >
          <TextField
            size="small"
            label="Patient ID or name"
            value={patientText}
            onChange={(event) => setPatientText(event.target.value)}
          />
          <TextField
            size="small"
            label="Payer name"
            value={payerText}
            onChange={(event) => setPayerText(event.target.value)}
          />
          <Button type="submit">Search</Button>
        </Box>
        <DateRangeInput
          label="Created date"
          valueFrom={dates.from}
          valueTo={dates.to}
          onChange={(from, to) => {
            setDates({ from, to });
            setPagination((previous) => ({ ...previous, page: 0 }));
          }}
        />
        <TextField
          select
          size="small"
          label="Status"
          value={status}
          sx={{ width: 220 }}
          onChange={(event) => {
            setStatus(event.target.value as typeof status);
            setPagination((previous) => ({ ...previous, page: 0 }));
          }}
        >
          <MenuItem value="">All statuses</MenuItem>
          {SearchBillingClaimTasksInputSchema.shape.status.unwrap().options.map((value) => (
            <MenuItem key={value} value={value}>
              {formatAntCaseString(value)}
            </MenuItem>
          ))}
        </TextField>
        <Button
          onClick={() => {
            setPatientText('');
            setPatient('');
            setPayerText('');
            setPayerName('');
            setStatus('');
            setDates({ from: '', to: '' });
            setPagination((previous) => ({ ...previous, page: 0 }));
          }}
        >
          Clear filters
        </Button>
      </Stack>
      {query.isError && (
        <Alert severity="error">
          {getApiError({ error: query.error, defaultError: 'Failed to load claim creation queue' })}
        </Alert>
      )}
      {query.data?.incomplete && !query.isError && (
        <Alert severity="warning">
          Some tasks may be missing from these results. Narrow the created date, status, or patient filters to see all
          matches.
        </Alert>
      )}
      <Box sx={{ height: 650, width: '100%' }}>
        <DataGridPro
          rows={query.data?.tasks ?? []}
          columns={columns}
          rowCount={query.data?.total ?? 0}
          loading={!oystehrZambda || query.isFetching}
          pagination
          paginationMode="server"
          paginationModel={pagination}
          onPaginationModelChange={setPagination}
          pageSizeOptions={[25, 50, 100]}
          disableRowSelectionOnClick
          disableColumnFilter
          getRowHeight={() => 'auto'}
          slots={dataGridSlots()}
          sx={dataGridSx}
        />
      </Box>
    </Stack>
  );
}
