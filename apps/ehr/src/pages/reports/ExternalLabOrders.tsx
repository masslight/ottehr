import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import ScienceIcon from '@mui/icons-material/Science';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
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
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import React, { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  DEFAULT_BATCH_DAYS,
  LabsRadsProdsReportZambdaOutput,
  OrderCategory,
  OrderReportItem,
  splitDateRangeIntoBatches,
} from 'utils';
import { getLabsRadsProdsReport } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import PageContainer from '../../layout/PageContainer';

interface OrderRow extends OrderReportItem {
  id: string;
}

type DateRangeFilter =
  | 'today'
  | 'yesterday'
  | 'last-7-days'
  | 'last-7-days-excluding-today'
  | 'last-30-days'
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

const dateFilterOperators: GridFilterOperator[] = [
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

const getStatusColor = (
  status: string
): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
  switch (status) {
    case 'active':
      return 'info';
    case 'completed':
      return 'success';
    case 'draft':
      return 'default';
    case 'revoked':
    case 'entered-in-error':
      return 'error';
    default:
      return 'warning';
  }
};

const getCategoryColor = (
  category: OrderCategory
): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
  switch (category) {
    case 'lab':
      return 'primary';
    case 'radiology':
      return 'info';
    case 'procedure':
      return 'secondary';
    default:
      return 'default';
  }
};

const getCategoryLabel = (category: OrderCategory): string => {
  switch (category) {
    case 'lab':
      return 'Lab';
    case 'radiology':
      return 'Radiology';
    case 'procedure':
      return 'Procedure';
    default:
      return category;
  }
};

const useLabsRadsProds = (
  dateRange: DateRangeFilter,
  start: string,
  end: string
): ReturnType<typeof useQuery<{ rows: OrderRow[]; report: LabsRadsProdsReportZambdaOutput | null }, Error>> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['labs-rads-prods', dateRange, start, end],
    queryFn: async (): Promise<{ rows: OrderRow[]; report: LabsRadsProdsReportZambdaOutput | null }> => {
      if (!oystehrZambda) {
        throw new Error('Oystehr client not available');
      }

      const startDate = DateTime.fromISO(start);
      const endDate = DateTime.fromISO(end);
      const daysDifference = endDate.diff(startDate, 'days').days;

      let allOrders: OrderReportItem[];
      let report: LabsRadsProdsReportZambdaOutput;

      if (daysDifference <= DEFAULT_BATCH_DAYS) {
        report = await getLabsRadsProdsReport(oystehrZambda, { dateRange: { start, end } });
        allOrders = report.orders;
      } else {
        const batches = splitDateRangeIntoBatches(start, end, DEFAULT_BATCH_DAYS);

        const batchPromises = batches.map(async (batch) => {
          const response = await getLabsRadsProdsReport(oystehrZambda, { dateRange: batch });
          return response.orders;
        });

        const batchResults = await Promise.all(batchPromises);
        allOrders = batchResults.flat();

        // Deduplicate by serviceRequestId
        allOrders = Array.from(new Map(allOrders.map((o) => [o.serviceRequestId, o])).values());

        // Re-aggregate summary
        const summaryMap = new Map<
          string,
          { orderName: string; orderCode?: string; orderCategory: OrderCategory; count: number }
        >();
        allOrders.forEach((order) => {
          const key = `${order.orderCategory}:${order.orderCode || order.orderName}`;
          const existing = summaryMap.get(key);
          if (existing) {
            existing.count++;
          } else {
            summaryMap.set(key, {
              orderName: order.orderName,
              orderCode: order.orderCode,
              orderCategory: order.orderCategory,
              count: 1,
            });
          }
        });

        report = {
          message: `Found ${allOrders.length} orders`,
          totalOrders: allOrders.length,
          summary: Array.from(summaryMap.values()).sort((a, b) => b.count - a.count),
          orders: allOrders,
          dateRange: { start, end },
        };
      }

      const rows: OrderRow[] = allOrders.map((order) => ({
        ...order,
        id: order.serviceRequestId,
      }));

      return { rows, report };
    },
    enabled: Boolean(oystehrZambda),
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
};

export default function ExternalLabOrders(): React.ReactElement {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRangeFilter>('last-7-days');
  const [customDate, setCustomDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [customStartDate, setCustomStartDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));

  const getDateRange = useCallback(
    (filter: DateRangeFilter): { start: string; end: string } => {
      const now = DateTime.now().setZone('America/New_York');
      const today = now.startOf('day');

      switch (filter) {
        case 'today':
          return { start: today.toISO() ?? '', end: today.endOf('day').toISO() ?? '' };
        case 'yesterday': {
          const yesterday = today.minus({ days: 1 });
          return { start: yesterday.toISO() ?? '', end: yesterday.endOf('day').toISO() ?? '' };
        }
        case 'last-7-days':
          return { start: today.minus({ days: 6 }).toISO() ?? '', end: today.endOf('day').toISO() ?? '' };
        case 'last-7-days-excluding-today':
          return {
            start: today.minus({ days: 6 }).toISO() ?? '',
            end: today.minus({ days: 1 }).endOf('day').toISO() ?? '',
          };
        case 'last-30-days':
          return { start: today.minus({ days: 29 }).toISO() ?? '', end: today.endOf('day').toISO() ?? '' };
        case 'custom': {
          const customDateTime = DateTime.fromISO(customDate).setZone('America/New_York');
          return { start: customDateTime.startOf('day').toISO() ?? '', end: customDateTime.endOf('day').toISO() ?? '' };
        }
        case 'customRange': {
          const startDateTime = DateTime.fromISO(customStartDate).setZone('America/New_York');
          const endDateTime = DateTime.fromISO(customEndDate).setZone('America/New_York');
          return {
            start: startDateTime.startOf('day').toISO() ?? '',
            end: endDateTime.endOf('day').toISO() ?? '',
          };
        }
        default:
          return { start: today.toISO() ?? '', end: today.endOf('day').toISO() ?? '' };
      }
    },
    [customDate, customStartDate, customEndDate]
  );

  const { start, end } = getDateRange(dateRange);
  const { data, isLoading, error, refetch } = useLabsRadsProds(dateRange, start, end);
  const rows = data?.rows ?? [];
  const report = data?.report ?? null;

  const handleBack = (): void => {
    navigate('/reports');
  };

  const handleDateRangeChange = (event: SelectChangeEvent<DateRangeFilter>): void => {
    setDateRange(event.target.value as DateRangeFilter);
  };

  const handleRefresh = (): void => {
    void refetch();
  };

  const CustomToolbar = (): React.ReactElement => {
    return (
      <GridToolbarContainer>
        <GridToolbarExport csvOptions={{ fileName: 'labs-rads-prods-report' }} />
      </GridToolbarContainer>
    );
  };

  // Count by category
  const labCount = rows.filter((r) => r.orderCategory === 'lab').length;
  const radCount = rows.filter((r) => r.orderCategory === 'radiology').length;
  const procCount = rows.filter((r) => r.orderCategory === 'procedure').length;

  const SummaryToolbar = (): React.ReactElement => (
    <GridToolbarContainer>
      <GridToolbarExport csvOptions={{ fileName: 'labs-rads-prods-summary' }} />
    </GridToolbarContainer>
  );

  const summaryColumns: GridColDef[] = useMemo(
    () => [
      {
        field: 'orderCategory',
        headerName: 'Type',
        width: 120,
        sortable: true,
        renderCell: (params: GridRenderCellParams) => (
          <Chip
            label={getCategoryLabel(params.value as OrderCategory)}
            color={getCategoryColor(params.value as OrderCategory)}
            size="small"
            variant="outlined"
          />
        ),
      },
      {
        field: 'orderName',
        headerName: 'Order Name',
        flex: 1,
        minWidth: 250,
        sortable: true,
      },
      {
        field: 'orderCode',
        headerName: 'Code',
        width: 150,
        sortable: true,
      },
      {
        field: 'count',
        headerName: 'Count',
        width: 100,
        sortable: true,
        type: 'number',
      },
    ],
    []
  );

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'orderCategory',
        headerName: 'Type',
        width: 120,
        sortable: true,
        renderCell: (params: GridRenderCellParams) => (
          <Chip
            label={getCategoryLabel(params.value as OrderCategory)}
            color={getCategoryColor(params.value as OrderCategory)}
            size="small"
            variant="outlined"
          />
        ),
      },
      {
        field: 'orderName',
        headerName: 'Order Name',
        width: 250,
        sortable: true,
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 120,
        sortable: true,
        renderCell: (params: GridRenderCellParams) => (
          <Chip label={params.value} color={getStatusColor(params.value as string)} size="small" variant="outlined" />
        ),
      },
      {
        field: 'orderDate',
        headerName: 'Order Date',
        width: 180,
        sortable: true,
        filterOperators: dateFilterOperators,
        renderCell: (params: GridRenderCellParams) => {
          return params.value ? DateTime.fromISO(params.value as string).toFormat('MM/dd/yyyy hh:mm a') : '';
        },
      },
      {
        field: 'patientName',
        headerName: 'Patient',
        width: 180,
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
        field: 'orderingProvider',
        headerName: 'Ordering Provider',
        width: 180,
        sortable: true,
      },
      {
        field: 'labOrganization',
        headerName: 'Lab',
        width: 150,
        sortable: true,
      },
      {
        field: 'location',
        headerName: 'Location',
        width: 150,
        sortable: true,
      },
      {
        field: 'isStat',
        headerName: 'STAT',
        width: 80,
        sortable: true,
        renderCell: (params: GridRenderCellParams) =>
          params.value ? <Chip label="Yes" size="small" color="error" variant="outlined" /> : '',
      },
      {
        field: 'diagnoses',
        headerName: 'Diagnoses',
        width: 250,
        sortable: false,
        renderCell: (params: GridRenderCellParams) => {
          const diagnoses = params.value as string[];
          return diagnoses?.join(', ') || '';
        },
      },
      {
        field: 'encounterDate',
        headerName: 'Encounter Date',
        width: 180,
        sortable: true,
        filterOperators: dateFilterOperators,
        renderCell: (params: GridRenderCellParams) => {
          return params.value ? DateTime.fromISO(params.value as string).toFormat('MM/dd/yyyy hh:mm a') : '';
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
            <ScienceIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h4" component="h1" color="primary.dark" fontWeight={600}>
              Labs, Rads, and Procs
            </Typography>
          </Box>
        </Box>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          This report shows external lab orders, radiology orders, and procedures from completed encounters. Use the
          Type column filter to narrow by order category.
        </Typography>

        {/* Date Filter */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Date Range</InputLabel>
            <Select value={dateRange} label="Date Range" onChange={handleDateRangeChange}>
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="yesterday">Yesterday</MenuItem>
              <MenuItem value="last-7-days">Last 7 Days</MenuItem>
              <MenuItem value="last-7-days-excluding-today">Last 7 Days (Excluding Today)</MenuItem>
              <MenuItem value="last-30-days">Last 30 Days</MenuItem>
              <MenuItem value="custom">Custom Date</MenuItem>
              <MenuItem value="customRange">Custom Date Range</MenuItem>
            </Select>
          </FormControl>

          {dateRange === 'custom' && (
            <TextField
              type="date"
              size="small"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
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
                onChange={(e) => setCustomStartDate(e.target.value)}
                sx={{ minWidth: 160 }}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                type="date"
                size="small"
                label="End Date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                sx={{ minWidth: 160 }}
                InputLabelProps={{ shrink: true }}
              />
            </>
          )}

          <Button variant="outlined" onClick={handleRefresh} disabled={isLoading} startIcon={<RefreshIcon />}>
            Refresh
          </Button>
        </Box>

        {/* Summary Cards */}
        {report && report.totalOrders > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {report.totalOrders} total orders
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
              <Card variant="outlined" sx={{ minWidth: 140 }}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="h5" color="primary.main" fontWeight={700}>
                    {labCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Lab Orders
                  </Typography>
                </CardContent>
              </Card>
              <Card variant="outlined" sx={{ minWidth: 140 }}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="h5" color="info.main" fontWeight={700}>
                    {radCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Radiology Orders
                  </Typography>
                </CardContent>
              </Card>
              <Card variant="outlined" sx={{ minWidth: 140 }}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="h5" color="secondary.main" fontWeight={700}>
                    {procCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Procedures
                  </Typography>
                </CardContent>
              </Card>
            </Box>
            {report.summary.length > 0 && (
              <Paper sx={{ height: 300, width: '100%' }}>
                <DataGridPro
                  rows={report.summary.map((item, idx) => ({ id: idx, ...item }))}
                  columns={summaryColumns}
                  density="compact"
                  initialState={{
                    pagination: { paginationModel: { pageSize: 25 } },
                    sorting: { sortModel: [{ field: 'count', sort: 'desc' }] },
                  }}
                  pageSizeOptions={[10, 25, 50]}
                  slots={{ toolbar: SummaryToolbar }}
                  disableRowSelectionOnClick
                  sx={{
                    '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600 },
                  }}
                />
              </Paper>
            )}
          </Box>
        )}

        {/* Data Grid */}
        <Paper sx={{ height: 600, width: '100%' }}>
          <DataGridPro
            rows={rows}
            columns={columns}
            getRowId={(row) => row.serviceRequestId}
            loading={isLoading}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 25 },
              },
              sorting: {
                sortModel: [{ field: 'orderDate', sort: 'desc' }],
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
              Error loading report: {error instanceof Error ? error.message : 'Unknown error'}
            </Typography>
          </Box>
        )}

        {!isLoading && rows.length === 0 && !error && (
          <Box sx={{ mt: 2, p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              No orders found for the selected date range
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
              Try selecting a different date range or check if there are completed encounters with lab orders, radiology
              orders, or procedures
            </Typography>
          </Box>
        )}
      </Box>
    </PageContainer>
  );
}
