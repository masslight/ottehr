import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import PreviewIcon from '@mui/icons-material/Preview';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Popper,
  Select,
  SelectChangeEvent,
  TextField,
  Tooltip,
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
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DEFAULT_BATCH_DAYS, MailedStatementItem, splitDateRangeIntoBatches } from 'utils';
import { getMailedStatementsReport } from '../../api/api';
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

const MAIL_STATUS_DISPLAY: Record<string, string> = {
  ready: 'Ready',
  printing: 'Printing',
  processed_for_delivery: 'Processed for Delivery',
  completed: 'Mailed',
  cancelled: 'Cancelled',
};

const MAILING_CLASS_DISPLAY: Record<string, string> = {
  first_class: 'First Class',
  standard_class: 'Standard Class',
  express: 'Express',
  certified: 'Certified',
  certified_return_receipt: 'Certified (Return Receipt)',
  registered: 'Registered',
  usps_first_class: 'USPS First Class',
  usps_standard_class: 'USPS Standard Class',
  usps_express_3_day: 'USPS Priority (2-3 Day)',
  usps_first_class_certified: 'USPS Certified First Class',
  usps_first_class_certified_return_receipt: 'USPS Certified First Class (Return Receipt)',
  ca_post_lettermail: 'Canada Post Lettermail',
  ca_post_personalized: 'Canada Post Personalized',
  ca_post_registered: 'Canada Post Registered',
  royal_mail_first_class: 'Royal Mail First Class',
  royal_mail_standard_class: 'Royal Mail Standard',
};

function formatDisplayName(raw: string, displayMap: Record<string, string>): string {
  if (!raw) return '-';
  return displayMap[raw] ?? raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function CopyableField({ label, value }: { label: string; value: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const handleCopy = (): void => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70 }}>
        {label}:
      </Typography>
      <Typography
        variant="caption"
        sx={{
          fontFamily: 'monospace',
          fontSize: '0.7rem',
          userSelect: 'all',
        }}
      >
        {value || '-'}
      </Typography>
      {value && (
        <IconButton size="small" onClick={handleCopy} sx={{ p: 0.25 }} aria-label={`Copy ${label}`}>
          {copied ? (
            <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />
          ) : (
            <ContentCopyIcon sx={{ fontSize: 14 }} />
          )}
        </IconButton>
      )}
    </Box>
  );
}

function StatusChipWithPopover({
  status,
  displayStatus,
  letterId,
  communicationId,
}: {
  status: string;
  displayStatus: string;
  letterId: string;
  communicationId: string;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = (): void => {
    if (closeTimeout.current) {
      clearTimeout(closeTimeout.current);
      closeTimeout.current = null;
    }
    setOpen(true);
  };

  const handleMouseLeave = (): void => {
    closeTimeout.current = setTimeout(() => setOpen(false), 200);
  };

  return (
    <Box onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} sx={{ display: 'inline-flex' }}>
      <Chip ref={anchorRef} label={displayStatus} color={getMailStatusColor(status)} size="small" variant="outlined" />
      <Popper open={open} anchorEl={anchorRef.current} placement="bottom-start" sx={{ zIndex: 1300 }}>
        <Paper
          elevation={8}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          sx={{
            p: 1.5,
            mt: 0.5,
            minWidth: 280,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
          }}
        >
          <Typography variant="caption" fontWeight={600} sx={{ mb: 0.5 }}>
            Mail Details
          </Typography>
          <CopyableField label="Letter ID" value={letterId} />
          <CopyableField label="Comm ID" value={communicationId} />
        </Paper>
      </Popper>
    </Box>
  );
}

function PreviewButton({ htmlContent, description }: { htmlContent: string; description: string }): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip title={description || 'Preview statement'} placement="top">
        <Button
          size="small"
          variant="text"
          startIcon={<PreviewIcon />}
          onClick={() => setOpen(true)}
          sx={{ textTransform: 'none' }}
        >
          Preview
        </Button>
      </Tooltip>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
          <Typography variant="h3" color="primary.dark" sx={{ fontWeight: '600 !important' }}>
            Statement Preview
          </Typography>
          <IconButton onClick={() => setOpen(false)} aria-label="close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box
            component="iframe"
            title="Statement Preview"
            sandbox="allow-scripts"
            srcDoc={htmlContent}
            sx={{
              width: '100%',
              minHeight: 800,
              border: 'none',
              backgroundColor: '#fff',
              borderRadius: 1,
              filter: 'grayscale(100%)',
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

interface MailedStatementsData {
  statements: MailedStatementItem[];
  lastSyncRunAt: string | null;
}

const useMailedStatements = (
  dateRange: DateRangeFilter,
  start: string,
  end: string
): ReturnType<typeof useQuery<MailedStatementsData, Error>> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['mailed-statements', dateRange, start, end],
    queryFn: async (): Promise<MailedStatementsData> => {
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
        return {
          statements: response.statements.sort(
            (a, b) => DateTime.fromISO(b.sentDate).toMillis() - DateTime.fromISO(a.sentDate).toMillis()
          ),
          lastSyncRunAt: response.lastSyncRunAt ?? null,
        };
      }

      const batches = splitDateRangeIntoBatches(start, end, DEFAULT_BATCH_DAYS);
      const batchResults = await Promise.all(
        batches.map((batch) => getMailedStatementsReport(oystehrZambda, { dateRange: batch }))
      );

      const allStatements = batchResults.flatMap((r) => r.statements);
      // Deduplicate by communicationId
      const unique = Array.from(new Map(allStatements.map((s) => [s.communicationId, s])).values());
      const lastSyncRunAt = batchResults.map((r) => r.lastSyncRunAt).find((v) => Boolean(v)) ?? null;

      return {
        statements: unique.sort(
          (a, b) => DateTime.fromISO(b.sentDate).toMillis() - DateTime.fromISO(a.sentDate).toMillis()
        ),
        lastSyncRunAt,
      };
    },
    enabled: Boolean(oystehrZambda && start && end),
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
};

export default function MailedStatements(): React.ReactElement {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRangeFilter>('today');
  const [customDate, setCustomDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [customStartDate, setCustomStartDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));

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
  const { data, isLoading, error } = useMailedStatements(dateRange, start, end);
  const statements = data?.statements ?? [];
  const lastSyncRunAt = data?.lastSyncRunAt ?? null;

  // The status-sync cron runs daily at 06:00 UTC; derive the next run from that schedule.
  const nextRun = useMemo(() => {
    const now = DateTime.utc();
    let next = now.set({ hour: 6, minute: 0, second: 0, millisecond: 0 });
    if (next <= now) {
      next = next.plus({ days: 1 });
    }
    return next;
  }, []);

  const formatRunTime = (dt: DateTime): string =>
    dt.setZone('America/New_York').toFormat("MMM d, yyyy 'at' h:mm a ZZZZ");

  const lastRunLabel = lastSyncRunAt ? formatRunTime(DateTime.fromISO(lastSyncRunAt)) : 'Never';
  const nextRunLabel = formatRunTime(nextRun);

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
          if (!patientId) {
            return <Typography variant="body2">{params.value}</Typography>;
          }
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
        headerName: 'Visit Date',
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
        headerName: 'Mail Status',
        width: 200,
        sortable: true,
        renderCell: (params: GridRenderCellParams) => {
          const status = (params.value as string) || 'unknown';
          const displayStatus = formatDisplayName(status, MAIL_STATUS_DISPLAY);
          const letterId = params.row.vendorLetterId as string;
          const commId = params.row.communicationId as string;
          return (
            <StatusChipWithPopover
              status={status}
              displayStatus={displayStatus}
              letterId={letterId}
              communicationId={commId}
            />
          );
        },
      },
      {
        field: 'vendorMailingClass',
        headerName: 'Mail Class',
        width: 150,
        sortable: true,
        renderCell: (params: GridRenderCellParams) => {
          const val = params.value as string;
          return formatDisplayName(val, MAILING_CLASS_DISPLAY);
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
          const display = formatDisplayName(val, {});
          return (
            <Tooltip title={display} placement="top">
              <span>{display}</span>
            </Tooltip>
          );
        },
      },
      {
        field: 'htmlContent',
        headerName: 'Preview',
        width: 100,
        sortable: false,
        filterable: false,
        disableExport: true,
        renderCell: (params: GridRenderCellParams) => {
          const htmlContent = params.value as string;
          const description = params.row.description as string;
          if (!htmlContent) return null;
          return <PreviewButton htmlContent={htmlContent} description={description} />;
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
          This report shows patient statements sent by mail. Click a patient name to navigate to their chart. Click the
          preview icon to view the mailed statement.
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

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3, color: 'text.secondary' }}>
          <Typography variant="body2">
            Statuses last updated: <strong>{lastRunLabel}</strong>
          </Typography>
          <Typography variant="body2">
            Next update: <strong>{nextRunLabel}</strong>
          </Typography>
        </Box>

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
      </Box>
    </PageContainer>
  );
}
