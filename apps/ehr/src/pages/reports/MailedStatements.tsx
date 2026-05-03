import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import SyncIcon from '@mui/icons-material/Sync';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import {
  DataGridPro,
  GridCellParams,
  GridColDef,
  GridFilterItem,
  GridFilterOperator,
  GridRenderCellParams,
  GridToolbarContainer,
  GridToolbarExport,
} from '@mui/x-data-grid-pro';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import React, { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DEFAULT_BATCH_DAYS, MailedStatementItem, splitDateRangeIntoBatches } from 'utils';
import { getMailedStatementsReport, syncMailedStatementStatuses } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import PageContainer from '../../layout/PageContainer';

type DateRangeFilter =
  | 'today'
  | 'yesterday'
  | 'month-to-date'
  | 'last-month'
  | 'this-quarter'
  | 'last-quarter'
  | 'custom'
  | 'customRange';

function SingleDateFilterInput({
  item,
  applyValue,
}: {
  item: GridFilterItem;
  applyValue: (value: GridFilterItem) => void;
}): React.ReactElement {
  return (
    <TextField
      type="date"
      size="small"
      label="Value"
      value={item.value ?? ''}
      onChange={(e) => applyValue({ ...item, value: e.target.value })}
      InputLabelProps={{ shrink: true }}
      sx={{ mt: 1 }}
    />
  );
}

function DateRangeFilterInput({
  item,
  applyValue,
}: {
  item: GridFilterItem;
  applyValue: (value: GridFilterItem) => void;
}): React.ReactElement {
  const [start, end] = Array.isArray(item.value) ? item.value : ['', ''];
  return (
    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
      <TextField
        type="date"
        size="small"
        label="From"
        value={start}
        onChange={(e) => applyValue({ ...item, value: [e.target.value, end] })}
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        type="date"
        size="small"
        label="To"
        value={end}
        onChange={(e) => applyValue({ ...item, value: [start, e.target.value] })}
        InputLabelProps={{ shrink: true }}
      />
    </Box>
  );
}

const sentDateFilterOperators: GridFilterOperator[] = [
  {
    label: 'is',
    value: 'dateIs',
    getApplyFilterFn: (filterItem: GridFilterItem) => {
      if (!filterItem.value) return null;
      return (params: GridCellParams) => {
        const iso = params.value as string;
        if (!iso) return false;
        return DateTime.fromISO(iso).toFormat('yyyy-MM-dd') === filterItem.value;
      };
    },
    InputComponent: SingleDateFilterInput,
    getValueAsString: (value: string) => value,
  },
  {
    label: 'is before',
    value: 'dateBefore',
    getApplyFilterFn: (filterItem: GridFilterItem) => {
      if (!filterItem.value) return null;
      return (params: GridCellParams) => {
        const iso = params.value as string;
        if (!iso) return false;
        return DateTime.fromISO(iso) < DateTime.fromISO(filterItem.value).startOf('day');
      };
    },
    InputComponent: SingleDateFilterInput,
    getValueAsString: (value: string) => value,
  },
  {
    label: 'is after',
    value: 'dateAfter',
    getApplyFilterFn: (filterItem: GridFilterItem) => {
      if (!filterItem.value) return null;
      return (params: GridCellParams) => {
        const iso = params.value as string;
        if (!iso) return false;
        return DateTime.fromISO(iso) > DateTime.fromISO(filterItem.value).endOf('day');
      };
    },
    InputComponent: SingleDateFilterInput,
    getValueAsString: (value: string) => value,
  },
  {
    label: 'is between',
    value: 'dateBetween',
    getApplyFilterFn: (filterItem: GridFilterItem) => {
      const [start, end] = Array.isArray(filterItem.value) ? filterItem.value : [null, null];
      if (!start || !end) return null;
      return (params: GridCellParams) => {
        const iso = params.value as string;
        if (!iso) return false;
        const cell = DateTime.fromISO(iso);
        return cell >= DateTime.fromISO(start).startOf('day') && cell <= DateTime.fromISO(end).endOf('day');
      };
    },
    InputComponent: DateRangeFilterInput,
    getValueAsString: (value: [string, string]) =>
      Array.isArray(value) ? `${value[0] ?? ''} – ${value[1] ?? ''}` : '',
  },
];

const getMailStatusColor = (
  status: string
): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
  switch (status.toLowerCase()) {
    case 'ready':
      return 'info';
    case 'printing':
    case 'processed_for_delivery':
      return 'warning';
    case 'completed':
      return 'success';
    case 'cancelled':
      return 'error';
    default:
      return 'default';
  }
};

const useMailedStatements = (
  dateRange: DateRangeFilter,
  start: string,
  end: string
): ReturnType<typeof useQuery<MailedStatementItem[], Error>> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['mailed-statements', dateRange, start, end],
    queryFn: async (): Promise<MailedStatementItem[]> => {
      if (!oystehrZambda) {
        throw new Error('Oystehr client not available');
      }

      const startDate = DateTime.fromISO(start);
      const endDate = DateTime.fromISO(end);
      const daysDifference = endDate.diff(startDate, 'days').days;

      if (daysDifference <= DEFAULT_BATCH_DAYS) {
        const response = await getMailedStatementsReport(oystehrZambda, {
          dateRange: { start, end },
        });
        return response.statements.sort(
          (a, b) => DateTime.fromISO(b.sentDate).toMillis() - DateTime.fromISO(a.sentDate).toMillis()
        );
      }

      const batches = splitDateRangeIntoBatches(start, end, DEFAULT_BATCH_DAYS);
      const batchResults = await Promise.all(
        batches.map(async (batch) => {
          const response = await getMailedStatementsReport(oystehrZambda, { dateRange: batch });
          return response.statements;
        })
      );

      const allStatements = batchResults.flat();
      // Deduplicate by communicationId
      const unique = Array.from(new Map(allStatements.map((s) => [s.communicationId, s])).values());

      return unique.sort((a, b) => DateTime.fromISO(b.sentDate).toMillis() - DateTime.fromISO(a.sentDate).toMillis());
    },
    enabled: Boolean(oystehrZambda && dateRange !== 'custom' && dateRange !== 'customRange'),
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
};

export default function MailedStatements(): React.ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { oystehrZambda } = useApiClients();
  const [dateRange, setDateRange] = useState<DateRangeFilter>('today');
  const [customDate, setCustomDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [customStartDate, setCustomStartDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSnackbar, setSyncSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const getDateRange = useCallback(
    (filter: DateRangeFilter): { start: string; end: string } => {
      const now = DateTime.now().setZone('America/New_York');
      const today = now.startOf('day');

      switch (filter) {
        case 'today': {
          return {
            start: today.toISO() ?? '',
            end: today.endOf('day').toISO() ?? '',
          };
        }
        case 'yesterday': {
          const yesterday = today.minus({ days: 1 });
          return {
            start: yesterday.toISO() ?? '',
            end: yesterday.endOf('day').toISO() ?? '',
          };
        }
        case 'month-to-date': {
          return {
            start: today.startOf('month').toISO() ?? '',
            end: today.endOf('day').toISO() ?? '',
          };
        }
        case 'last-month': {
          const lastMonth = today.minus({ months: 1 });
          return {
            start: lastMonth.startOf('month').toISO() ?? '',
            end: lastMonth.endOf('month').toISO() ?? '',
          };
        }
        case 'this-quarter': {
          return {
            start: today.startOf('quarter').toISO() ?? '',
            end: today.endOf('day').toISO() ?? '',
          };
        }
        case 'last-quarter': {
          const lastQuarter = today.minus({ quarters: 1 });
          return {
            start: lastQuarter.startOf('quarter').toISO() ?? '',
            end: lastQuarter.endOf('quarter').toISO() ?? '',
          };
        }
        case 'custom': {
          const customDateTime = DateTime.fromISO(customDate).setZone('America/New_York');
          return {
            start: customDateTime.startOf('day').toISO() ?? '',
            end: customDateTime.endOf('day').toISO() ?? '',
          };
        }
        case 'customRange': {
          const startDateTime = DateTime.fromISO(customStartDate).setZone('America/New_York');
          const endDateTime = DateTime.fromISO(customEndDate).setZone('America/New_York');
          return {
            start: startDateTime.startOf('day').toISO() ?? '',
            end: endDateTime.endOf('day').toISO() ?? '',
          };
        }
        default: {
          return {
            start: today.toISO() ?? '',
            end: today.endOf('day').toISO() ?? '',
          };
        }
      }
    },
    [customDate, customStartDate, customEndDate]
  );

  const { start, end } = getDateRange(dateRange);
  const { data: statements = [], isLoading, error } = useMailedStatements(dateRange, start, end);

  const handleBack = (): void => {
    navigate('/reports');
  };

  const handleDateRangeChange = (event: SelectChangeEvent<DateRangeFilter>): void => {
    setDateRange(event.target.value as DateRangeFilter);
  };

  const handleCustomDateChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setCustomDate(event.target.value);
  };

  const handleCustomStartDateChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setCustomStartDate(event.target.value);
  };

  const handleCustomEndDateChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setCustomEndDate(event.target.value);
  };

  const handleSyncStatuses = async (): Promise<void> => {
    if (!oystehrZambda) return;
    setIsSyncing(true);
    try {
      const result = await syncMailedStatementStatuses(oystehrZambda);
      await queryClient.invalidateQueries({ queryKey: ['mailed-statements'] });
      setSyncSnackbar({
        open: true,
        message: `Sync complete: ${result.updated} updated, ${result.alreadyTerminal} already terminal, ${result.errors.length} errors out of ${result.total} total`,
        severity: result.errors.length > 0 ? 'error' : 'success',
      });
    } catch (error: unknown) {
      setSyncSnackbar({
        open: true,
        message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const CustomToolbar = (): React.ReactElement => {
    return (
      <GridToolbarContainer>
        <GridToolbarExport
          csvOptions={{ fileName: 'mailed-statements-report' }}
          printOptions={{ disableToolbarButton: true }}
        />
      </GridToolbarContainer>
    );
  };

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'patientName',
        headerName: 'Patient',
        width: 200,
        sortable: true,
        renderCell: (params: GridRenderCellParams) => {
          const patientId = params.row.patientId;
          return (
            <Link
              to={`/patient/${patientId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#1976d2', textDecoration: 'underline' }}
            >
              {params.value}
            </Link>
          );
        },
      },
      {
        field: 'recipientName',
        headerName: 'Responsible Party',
        width: 200,
        sortable: true,
      },
      {
        field: 'appointmentDate',
        headerName: 'Date of Visit',
        width: 160,
        sortable: true,
        valueFormatter: (params) => {
          if (!params.value) return '-';
          const dt = DateTime.fromISO(params.value as string);
          return dt.isValid ? dt.toFormat('yyyy-MMM-dd') : (params.value as string);
        },
        renderCell: (params: GridRenderCellParams) => {
          const val = params.value as string;
          if (!val) return '-';
          const dt = DateTime.fromISO(val);
          const formatted = dt.isValid ? dt.toFormat('yyyy-MMM-dd') : val;
          const appointmentId = params.row.appointmentId as string;
          if (!appointmentId) return formatted;
          return (
            <Link
              to={`/visit/${appointmentId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#1976d2', textDecoration: 'underline' }}
            >
              {formatted}
            </Link>
          );
        },
      },
      {
        field: 'sentDate',
        headerName: 'Send Date',
        width: 180,
        sortable: true,
        filterOperators: sentDateFilterOperators,
        valueFormatter: (params) => {
          if (!params.value) return 'Unknown';
          return DateTime.fromISO(params.value as string).toFormat('yyyy-MMM-dd');
        },
        renderCell: (params: GridRenderCellParams) => {
          const iso = params.value as string;
          if (!iso) return 'Unknown';
          const dt = DateTime.fromISO(iso);
          return <span title={dt.toFormat('yyyy-MMM-dd hh:mm a')}>{dt.toFormat('yyyy-MMM-dd')}</span>;
        },
      },
      {
        field: 'vendorLetterStatus',
        headerName: 'Status',
        width: 160,
        sortable: true,
        renderCell: (params: GridRenderCellParams) => {
          const status = (params.value as string) || 'unknown';
          return <Chip label={status} color={getMailStatusColor(status)} size="small" variant="outlined" />;
        },
      },
      {
        field: 'vendorMailingClass',
        headerName: 'Mail Class',
        width: 130,
        sortable: true,
        renderCell: (params: GridRenderCellParams) => {
          const val = params.value as string;
          return val || '-';
        },
      },
      {
        field: 'vendorPageCount',
        headerName: 'Pages',
        width: 80,
        sortable: true,
        renderCell: (params: GridRenderCellParams) => {
          const val = params.value as string;
          return val || '-';
        },
      },
      {
        field: 'vendorEnvelopeType',
        headerName: 'Envelope',
        width: 130,
        sortable: true,
        renderCell: (params: GridRenderCellParams) => {
          const val = params.value as string;
          return val || '-';
        },
      },
      {
        field: 'communicationId',
        headerName: 'Communication ID',
        width: 320,
        sortable: true,
        disableExport: true,
        renderCell: (params: GridRenderCellParams) => {
          const id = params.value as string;
          if (!id) return '-';
          return <span style={{ fontFamily: 'monospace' }}>{id}</span>;
        },
      },
    ],
    []
  );

  return (
    <PageContainer>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleBack} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <MailOutlineIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h4" component="h1" color="primary.dark" fontWeight={600}>
              Mailed Statements
            </Typography>
          </Box>
        </Box>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          This report shows patient statements sent by mail via PostGrid. Click a patient name to navigate to their
          chart. Use the PDF link to view the mailed letter.
        </Typography>

        {/* Date Filter */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Date Range</InputLabel>
            <Select value={dateRange} label="Date Range" onChange={handleDateRangeChange}>
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="yesterday">Yesterday</MenuItem>
              <MenuItem value="month-to-date">Month to Date</MenuItem>
              <MenuItem value="last-month">Last Month</MenuItem>
              <MenuItem value="this-quarter">This Quarter</MenuItem>
              <MenuItem value="last-quarter">Last Quarter</MenuItem>
              <MenuItem value="custom">Custom Date</MenuItem>
              <MenuItem value="customRange">Custom Date Range</MenuItem>
            </Select>
          </FormControl>

          {dateRange === 'custom' && (
            <TextField
              type="date"
              size="small"
              value={customDate}
              onChange={handleCustomDateChange}
              sx={{ minWidth: 160 }}
              InputLabelProps={{ shrink: true }}
            />
          )}

          {dateRange === 'customRange' && (
            <>
              <TextField
                type="date"
                size="small"
                label="Start Date"
                value={customStartDate}
                onChange={handleCustomStartDateChange}
                sx={{ minWidth: 160 }}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                type="date"
                size="small"
                label="End Date"
                value={customEndDate}
                onChange={handleCustomEndDateChange}
                sx={{ minWidth: 160 }}
                InputLabelProps={{ shrink: true }}
              />
            </>
          )}

          <Button
            variant="outlined"
            startIcon={isSyncing ? <CircularProgress size={16} /> : <SyncIcon />}
            onClick={handleSyncStatuses}
            disabled={isSyncing}
            size="small"
          >
            {isSyncing ? 'Syncing...' : 'Sync Statuses'}
          </Button>
        </Box>

        <Paper
          sx={{
            mb: 3,
            px: 3,
            py: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
          }}
        >
          <MailOutlineIcon />
          <Typography variant="h5" fontWeight={700}>
            {isLoading ? '...' : statements.length}
          </Typography>
          <Typography variant="h6">{statements.length === 1 ? 'statement' : 'statements'} sent</Typography>
        </Paper>

        <Paper sx={{ height: 600, width: '100%' }}>
          <DataGridPro
            rows={statements}
            columns={columns}
            getRowId={(row) => row.communicationId}
            loading={isLoading}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 25 },
              },
              sorting: {
                sortModel: [{ field: 'sentDate', sort: 'desc' }],
              },
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            slots={{
              toolbar: CustomToolbar,
            }}
            disableRowSelectionOnClick
            sx={{
              '& .MuiDataGrid-cell': {
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              },
              '& .MuiDataGrid-columnHeaderTitle': {
                fontWeight: 600,
              },
            }}
          />
        </Paper>

        {error && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
            <Typography color="error">
              Error loading mailed statements: {error instanceof Error ? error.message : 'Unknown error'}
            </Typography>
          </Box>
        )}

        {!isLoading && statements.length === 0 && !error && (
          <Box sx={{ mt: 2, p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              No mailed statements found for the selected date range
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
              Try selecting a different date range
            </Typography>
          </Box>
        )}

        <Snackbar
          open={syncSnackbar.open}
          autoHideDuration={6000}
          onClose={() => setSyncSnackbar((prev) => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setSyncSnackbar((prev) => ({ ...prev, open: false }))}
            severity={syncSnackbar.severity}
            variant="filled"
          >
            {syncSnackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </PageContainer>
  );
}
