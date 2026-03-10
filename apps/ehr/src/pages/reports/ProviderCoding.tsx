import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CodeIcon from '@mui/icons-material/Code';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Box,
  Button,
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
import { DataGridPro, GridColDef, GridToolbarContainer, GridToolbarExport } from '@mui/x-data-grid-pro';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_BATCH_DAYS, IncompleteEncounterItem, splitDateRangeIntoBatches } from 'utils';
import { getEncountersReport } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import PageContainer from '../../layout/PageContainer';

interface ProviderCodingRow {
  id: string;
  providerName: string;
  totalCoded: number;
  level2: number;
  lowComplexity: number;
  mediumComplexity: number;
  highComplexity: number;
  averageCodingLevel: number | null;
  avgTimeWithPatient: number | null;
}

type DateRangeFilter =
  | 'today'
  | 'yesterday'
  | 'last-7-days'
  | 'last-7-days-excluding-today'
  | 'last-30-days'
  | 'custom'
  | 'customRange';

const LEVEL2_CODES = ['99202', '99212'];
const LOW_CODES = ['99203', '99213'];
const MEDIUM_CODES = ['99204', '99214'];
const HIGH_CODES = ['99205', '99215'];

function aggregateByProvider(encounters: IncompleteEncounterItem[]): ProviderCodingRow[] {
  const providerMap = new Map<
    string,
    { level2: number; low: number; medium: number; high: number; otherCoded: number; durations: number[] }
  >();

  for (const encounter of encounters) {
    // Skip encounters without E&M codes
    if (!encounter.emCode) continue;

    const provider = encounter.attendingProvider || 'Unknown';
    if (!providerMap.has(provider)) {
      providerMap.set(provider, { level2: 0, low: 0, medium: 0, high: 0, otherCoded: 0, durations: [] });
    }
    const stats = providerMap.get(provider)!;

    if (LEVEL2_CODES.includes(encounter.emCode)) {
      stats.level2++;
    } else if (LOW_CODES.includes(encounter.emCode)) {
      stats.low++;
    } else if (MEDIUM_CODES.includes(encounter.emCode)) {
      stats.medium++;
    } else if (HIGH_CODES.includes(encounter.emCode)) {
      stats.high++;
    } else {
      stats.otherCoded++;
    }

    if (encounter.providerToDischargedMinutes != null) {
      stats.durations.push(encounter.providerToDischargedMinutes);
    }
  }

  const rows: ProviderCodingRow[] = [];
  for (const [providerName, stats] of providerMap.entries()) {
    const trackedTotal = stats.level2 + stats.low + stats.medium + stats.high;
    const averageCodingLevel =
      trackedTotal > 0 ? (stats.level2 * 2 + stats.low * 3 + stats.medium * 4 + stats.high * 5) / trackedTotal : null;

    const avgTimeWithPatient =
      stats.durations.length > 0 ? stats.durations.reduce((sum, d) => sum + d, 0) / stats.durations.length : null;

    rows.push({
      id: providerName,
      providerName,
      totalCoded: trackedTotal + stats.otherCoded,
      level2: stats.level2,
      lowComplexity: stats.low,
      mediumComplexity: stats.medium,
      highComplexity: stats.high,
      averageCodingLevel,
      avgTimeWithPatient,
    });
  }

  return rows.sort((a, b) => a.providerName.localeCompare(b.providerName));
}

const useProviderCoding = (
  dateRange: DateRangeFilter,
  start: string,
  end: string
): ReturnType<typeof useQuery<ProviderCodingRow[], Error>> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['provider-kpis', dateRange, start, end],
    queryFn: async (): Promise<ProviderCodingRow[]> => {
      if (!oystehrZambda) {
        throw new Error('Oystehr client not available');
      }

      const startDate = DateTime.fromISO(start);
      const endDate = DateTime.fromISO(end);
      const daysDifference = endDate.diff(startDate, 'days').days;

      if (daysDifference <= DEFAULT_BATCH_DAYS) {
        const response = await getEncountersReport(oystehrZambda, {
          dateRange: { start, end },
          encounterStatus: 'complete',
          includeEmCodes: true,
        });
        return aggregateByProvider(response.encounters);
      }

      const batches = splitDateRangeIntoBatches(start, end, DEFAULT_BATCH_DAYS);
      const batchPromises = batches.map(async (batch) => {
        const response = await getEncountersReport(oystehrZambda, {
          dateRange: batch,
          encounterStatus: 'complete',
          includeEmCodes: true,
        });
        return response.encounters;
      });

      const batchResults = await Promise.all(batchPromises);
      const allEncounters = batchResults.flat();

      // Deduplicate by appointmentId
      const unique = Array.from(new Map(allEncounters.map((e) => [e.appointmentId, e])).values());

      return aggregateByProvider(unique);
    },
    enabled: Boolean(oystehrZambda),
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
};

export default function ProviderCoding(): React.ReactElement {
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
  const { data: providers = [], isLoading, error, refetch } = useProviderCoding(dateRange, start, end);

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'providerName',
        headerName: 'Provider',
        width: 250,
        sortable: true,
      },
      {
        field: 'totalCoded',
        headerName: 'Total Coded',
        width: 120,
        sortable: true,
        type: 'number',
        headerAlign: 'center' as const,
        align: 'center' as const,
      },
      {
        field: 'level2',
        headerName: 'Level 2 (99202/99212)',
        width: 190,
        sortable: true,
        type: 'number',
        headerAlign: 'center' as const,
        align: 'center' as const,
      },
      {
        field: 'lowComplexity',
        headerName: 'Low (99203/99213)',
        width: 170,
        sortable: true,
        type: 'number',
        headerAlign: 'center' as const,
        align: 'center' as const,
      },
      {
        field: 'mediumComplexity',
        headerName: 'Medium (99204/99214)',
        width: 190,
        sortable: true,
        type: 'number',
        headerAlign: 'center' as const,
        align: 'center' as const,
      },
      {
        field: 'highComplexity',
        headerName: 'High (99205/99215)',
        width: 180,
        sortable: true,
        type: 'number',
        headerAlign: 'center' as const,
        align: 'center' as const,
      },
      {
        field: 'averageCodingLevel',
        headerName: 'Avg Coding Level',
        width: 160,
        sortable: true,
        type: 'number',
        headerAlign: 'center' as const,
        align: 'center' as const,
        valueFormatter: (params) => {
          if (params.value === null || params.value === undefined) return '-';
          return (params.value as number).toFixed(2);
        },
      },
      {
        field: 'avgTimeWithPatient',
        headerName: 'Avg Time with Patient (min)',
        width: 220,
        sortable: true,
        type: 'number',
        headerAlign: 'center' as const,
        align: 'center' as const,
        valueFormatter: (params) => {
          if (params.value === null || params.value === undefined) return '-';
          return (params.value as number).toFixed(1);
        },
      },
    ],
    []
  );

  const CustomToolbar = (): React.ReactElement => (
    <GridToolbarContainer>
      <GridToolbarExport csvOptions={{ fileName: 'provider-kpis-report' }} />
    </GridToolbarContainer>
  );

  return (
    <PageContainer>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => navigate('/reports')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CodeIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h4" component="h1" color="primary.dark" fontWeight={600}>
              Provider KPIs
            </Typography>
          </Box>
        </Box>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          This report shows E&M coding distribution by attending provider for completed encounters. The average coding
          level is a weighted average where Low = Level 3, Medium = Level 4, and High = Level 5.
        </Typography>

        {/* Date Filter */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Date Range</InputLabel>
            <Select
              value={dateRange}
              label="Date Range"
              onChange={(event: SelectChangeEvent<DateRangeFilter>) =>
                setDateRange(event.target.value as DateRangeFilter)
              }
            >
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomDate(e.target.value)}
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomStartDate(e.target.value)}
                sx={{ minWidth: 160 }}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                type="date"
                size="small"
                label="End Date"
                value={customEndDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomEndDate(e.target.value)}
                sx={{ minWidth: 160 }}
                InputLabelProps={{ shrink: true }}
              />
            </>
          )}

          <Button variant="outlined" onClick={() => void refetch()} disabled={isLoading} startIcon={<RefreshIcon />}>
            Refresh
          </Button>
        </Box>

        <Paper sx={{ height: 600, width: '100%' }}>
          <DataGridPro
            rows={providers}
            columns={columns}
            loading={isLoading}
            initialState={{
              pagination: { paginationModel: { pageSize: 25 } },
              sorting: { sortModel: [{ field: 'providerName', sort: 'asc' }] },
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            slots={{ toolbar: CustomToolbar }}
            disableRowSelectionOnClick
            sx={{
              '& .MuiDataGrid-cell': { overflow: 'hidden', textOverflow: 'ellipsis' },
              '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600 },
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

        {!isLoading && providers.length === 0 && !error && (
          <Box sx={{ mt: 2, p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              No provider coding data found for the selected date range
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
              Try selecting a different date range or check if there are any completed encounters with E&M codes
            </Typography>
          </Box>
        )}
      </Box>
    </PageContainer>
  );
}
