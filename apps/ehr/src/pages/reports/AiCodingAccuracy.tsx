import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
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
import {
  DataGridPro,
  GridColDef,
  GridRenderCellParams,
  GridToolbarContainer,
  GridToolbarExport,
} from '@mui/x-data-grid-pro';
import { useQuery } from '@tanstack/react-query';
import { Location } from 'fhir/r4b';
import { DateTime } from 'luxon';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DEFAULT_BATCH_DAYS, splitDateRangeIntoBatches } from 'utils';
import { getAiCodingAccuracyReport } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import PageContainer from '../../layout/PageContainer';

interface CodingAccuracyRow {
  id: string;
  encounterId: string;
  appointmentId: string;
  patientName: string;
  appointmentTime: string;
  appointmentStart: string;
  location: string;
  provider: string;
  suggestionCount: number;
  suggestedIcd: string;
  actualIcd: string;
  suggestedCpt: string;
  actualCpt: string;
  suggestedEm: string;
  actualEm: string;
  icdValidRate: string;
  icdInvalidRate: string;
  cptValidRate: string;
  cptInvalidRate: string;
  emMatch: boolean;
}

type DateRangeFilter = 'today' | 'yesterday' | 'last-7-days' | 'last-30-days' | 'custom' | 'customRange';

const CodeList: React.FC<{
  codes: string;
  matchedCodes?: Set<string>;
}> = ({ codes, matchedCodes }) => {
  if (!codes)
    return (
      <Typography variant="body2" color="text.secondary">
        —
      </Typography>
    );
  return (
    <Typography variant="body2" sx={{ fontSize: 12 }}>
      {codes.split(', ').map((code, i) => {
        const isMatched = matchedCodes?.has(code);
        return (
          <span key={code}>
            {i > 0 && ', '}
            <span
              style={{
                color: matchedCodes ? (isMatched ? '#2e7d32' : '#666') : undefined,
                fontWeight: isMatched ? 600 : 400,
              }}
            >
              {code}
            </span>
          </span>
        );
      })}
    </Typography>
  );
};

function CustomToolbar(): React.ReactElement {
  return (
    <GridToolbarContainer>
      <GridToolbarExport />
    </GridToolbarContainer>
  );
}

const useAiCodingAccuracy = (
  dateRange: DateRangeFilter,
  start: string,
  end: string,
  selectedLocationId: string
): ReturnType<typeof useQuery<{ rows: CodingAccuracyRow[]; summary: any }, Error>> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['ai-coding-accuracy', dateRange, start, end, selectedLocationId],
    queryFn: async () => {
      if (!oystehrZambda) throw new Error('Oystehr client not available');

      const locationIds = selectedLocationId !== 'all' ? [selectedLocationId] : undefined;
      const startDate = DateTime.fromISO(start);
      const endDate = DateTime.fromISO(end);
      const daysDifference = endDate.diff(startDate, 'days').days;

      let allEncounters: any[] = [];

      if (daysDifference <= DEFAULT_BATCH_DAYS) {
        const response = await getAiCodingAccuracyReport(oystehrZambda, { dateRange: { start, end }, locationIds });
        allEncounters = response.encounters || [];
      } else {
        const batches = splitDateRangeIntoBatches(start, end, DEFAULT_BATCH_DAYS);
        const batchResults = await Promise.all(
          batches.map((batch) => getAiCodingAccuracyReport(oystehrZambda, { dateRange: batch, locationIds }))
        );
        allEncounters = batchResults.flatMap((r) => r.encounters || []);
      }

      const rows: CodingAccuracyRow[] = allEncounters.map((enc: any) => ({
        id: enc.encounterId,
        encounterId: enc.encounterId,
        appointmentId: enc.appointmentId,
        patientName: enc.patientName,
        appointmentTime: enc.appointmentStart
          ? DateTime.fromISO(enc.appointmentStart).toFormat('MM/dd/yyyy hh:mm a')
          : 'Unknown',
        appointmentStart: enc.appointmentStart || '',
        location: enc.location,
        provider: enc.provider,
        suggestionCount: enc.suggestionCount || 1,
        suggestedIcd: (enc.suggestedIcd || []).join(', '),
        actualIcd: (enc.actualIcd || []).join(', '),
        suggestedCpt: (enc.suggestedCpt || []).join(', '),
        actualCpt: (enc.actualCpt || []).join(', '),
        suggestedEm: (enc.suggestedEm || []).join(', '),
        actualEm: enc.actualEm || '',
        icdValidRate: enc.icdValidRate || '',
        icdInvalidRate: enc.icdInvalidRate || '',
        cptValidRate: enc.cptValidRate || '',
        cptInvalidRate: enc.cptInvalidRate || '',
        emMatch: enc.emMatch,
      }));

      rows.sort(
        (a, b) => DateTime.fromISO(b.appointmentStart).toMillis() - DateTime.fromISO(a.appointmentStart).toMillis()
      );

      // Compute coverage rates client-side
      const withActualIcd = rows.filter((r) => r.icdValidRate);
      const withActualCpt = rows.filter((r) => r.cptValidRate);
      const withActualEm = rows.filter((r) => r.actualEm);
      const parseCoverage = (c: string): number => {
        const [matched, total] = c.split('/').map(Number);
        return total > 0 ? matched / total : 0;
      };
      const withSuggestedIcd = rows.filter((r) => r.icdInvalidRate);
      const withSuggestedCpt = rows.filter((r) => r.cptInvalidRate);
      const summary = {
        totalEncounters: rows.length,
        icdValidRate:
          withActualIcd.length > 0
            ? Math.round(
                (withActualIcd.reduce((s, r) => s + parseCoverage(r.icdValidRate), 0) / withActualIcd.length) * 100
              )
            : 0,
        icdInvalidRate:
          withSuggestedIcd.length > 0
            ? Math.round(
                (withSuggestedIcd.reduce((s, r) => s + parseCoverage(r.icdInvalidRate), 0) / withSuggestedIcd.length) *
                  100
              )
            : 0,
        cptValidRate:
          withActualCpt.length > 0
            ? Math.round(
                (withActualCpt.reduce((s, r) => s + parseCoverage(r.cptValidRate), 0) / withActualCpt.length) * 100
              )
            : 0,
        cptInvalidRate:
          withSuggestedCpt.length > 0
            ? Math.round(
                (withSuggestedCpt.reduce((s, r) => s + parseCoverage(r.cptInvalidRate), 0) / withSuggestedCpt.length) *
                  100
              )
            : 0,
        emMatchRate:
          withActualEm.length > 0
            ? Math.round((withActualEm.filter((r) => r.emMatch).length / withActualEm.length) * 100)
            : 0,
      };
      return { rows, summary };
    },
    enabled: Boolean(oystehrZambda && dateRange !== 'custom' && dateRange !== 'customRange'),
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
};

export default function AiCodingAccuracy(): React.ReactElement {
  const navigate = useNavigate();
  const { oystehr } = useApiClients();
  const [dateRange, setDateRange] = useState<DateRangeFilter>('today');
  const [customDate, setCustomDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [customStartDate, setCustomStartDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState<boolean>(true);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');

  useEffect(() => {
    const fetchLocations = async (): Promise<void> => {
      if (!oystehr) return;
      try {
        setLoadingLocations(true);
        const locationResults = await oystehr.fhir.search<Location>({
          resourceType: 'Location',
          params: [
            { name: '_count', value: '1000' },
            { name: '_sort', value: 'name' },
          ],
        });
        setLocations(locationResults.unbundle());
      } catch (err) {
        console.error('Error fetching locations:', err);
      } finally {
        setLoadingLocations(false);
      }
    };
    void fetchLocations();
  }, [oystehr]);

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
        case 'last-30-days':
          return { start: today.minus({ days: 29 }).toISO() ?? '', end: today.endOf('day').toISO() ?? '' };
        case 'custom': {
          const customDay = DateTime.fromFormat(customDate, 'yyyy-MM-dd').setZone('America/New_York');
          return { start: customDay.startOf('day').toISO() ?? '', end: customDay.endOf('day').toISO() ?? '' };
        }
        case 'customRange': {
          const rangeStart = DateTime.fromFormat(customStartDate, 'yyyy-MM-dd').setZone('America/New_York');
          const rangeEnd = DateTime.fromFormat(customEndDate, 'yyyy-MM-dd').setZone('America/New_York');
          return { start: rangeStart.startOf('day').toISO() ?? '', end: rangeEnd.endOf('day').toISO() ?? '' };
        }
        default:
          return { start: today.toISO() ?? '', end: today.endOf('day').toISO() ?? '' };
      }
    },
    [customDate, customStartDate, customEndDate]
  );

  const { start, end } = useMemo(() => getDateRange(dateRange), [dateRange, getDateRange]);
  const { data, isLoading, refetch } = useAiCodingAccuracy(dateRange, start, end, selectedLocationId);
  const rows = data?.rows || [];
  const summary = data?.summary;

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'patientName',
        headerName: 'Patient',
        width: 160,
        renderCell: (params: GridRenderCellParams) => (
          <Link to={`/in-person/${params.row.appointmentId}`} style={{ color: '#2169F5', textDecoration: 'none' }}>
            {params.value}
          </Link>
        ),
      },
      { field: 'appointmentTime', headerName: 'Date', width: 150 },
      { field: 'location', headerName: 'Location', width: 130 },
      { field: 'provider', headerName: 'Provider', width: 140 },
      { field: 'suggestionCount', headerName: 'Runs', width: 60, align: 'center', headerAlign: 'center' },
      {
        field: 'suggestedIcd',
        headerName: 'Suggested ICD',
        width: 180,
        renderCell: (params: GridRenderCellParams) => {
          const actualCodes = new Set((params.row.actualIcd as string).split(', ').filter(Boolean));
          return <CodeList codes={params.value} matchedCodes={actualCodes} />;
        },
      },
      {
        field: 'actualIcd',
        headerName: 'Actual ICD',
        width: 180,
        renderCell: (params: GridRenderCellParams) => {
          const suggestedCodes = new Set((params.row.suggestedIcd as string).split(', ').filter(Boolean));
          return <CodeList codes={params.value} matchedCodes={suggestedCodes} />;
        },
      },
      { field: 'icdValidRate', headerName: 'ICD Valid', width: 70, align: 'center', headerAlign: 'center' },
      { field: 'icdInvalidRate', headerName: 'ICD Invalid', width: 70, align: 'center', headerAlign: 'center' },
      {
        field: 'suggestedCpt',
        headerName: 'Suggested CPT',
        width: 160,
        renderCell: (params: GridRenderCellParams) => {
          const actualCodes = new Set((params.row.actualCpt as string).split(', ').filter(Boolean));
          return <CodeList codes={params.value} matchedCodes={actualCodes} />;
        },
      },
      {
        field: 'actualCpt',
        headerName: 'Actual CPT',
        width: 160,
        renderCell: (params: GridRenderCellParams) => {
          const suggestedCodes = new Set((params.row.suggestedCpt as string).split(', ').filter(Boolean));
          return <CodeList codes={params.value} matchedCodes={suggestedCodes} />;
        },
      },
      { field: 'cptValidRate', headerName: 'CPT Valid', width: 70, align: 'center', headerAlign: 'center' },
      { field: 'cptInvalidRate', headerName: 'CPT Invalid', width: 75, align: 'center', headerAlign: 'center' },
      { field: 'suggestedEm', headerName: 'Suggested E&M', width: 120 },
      { field: 'actualEm', headerName: 'Actual E&M', width: 100 },
      {
        field: 'emMatch',
        headerName: 'E&M',
        width: 60,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params: GridRenderCellParams) =>
          !params.row.actualEm ? null : params.value ? (
            <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
          ) : (
            <HighlightOffIcon sx={{ color: 'error.main', fontSize: 20 }} />
          ),
      },
    ],
    []
  );

  return (
    <PageContainer>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton onClick={() => navigate('/reports')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <CompareArrowsIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            AI Coding Accuracy
          </Typography>
        </Box>

        {/* Summary bar */}
        {summary && summary.totalEncounters > 0 && (
          <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 4, alignItems: 'center' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Encounters
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {summary.totalEncounters}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                ICD Valid Suggestion Rate
              </Typography>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, color: summary.icdValidRate >= 50 ? 'success.main' : 'error.main' }}
              >
                {summary.icdValidRate}%
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                ICD Invalid Suggestion Rate
              </Typography>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, color: summary.icdInvalidRate <= 50 ? 'success.main' : 'error.main' }}
              >
                {summary.icdInvalidRate}%
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                CPT Valid Suggestion Rate
              </Typography>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, color: summary.cptValidRate >= 50 ? 'success.main' : 'error.main' }}
              >
                {summary.cptValidRate}%
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                CPT Invalid Suggestion Rate
              </Typography>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, color: summary.cptInvalidRate <= 50 ? 'success.main' : 'error.main' }}
              >
                {summary.cptInvalidRate}%
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                E&M Match Rate
              </Typography>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, color: summary.emMatchRate >= 50 ? 'success.main' : 'error.main' }}
              >
                {summary.emMatchRate}%
              </Typography>
            </Box>
          </Paper>
        )}

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Date Range</InputLabel>
              <Select
                value={dateRange}
                label="Date Range"
                onChange={(e: SelectChangeEvent) => setDateRange(e.target.value as DateRangeFilter)}
              >
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="yesterday">Yesterday</MenuItem>
                <MenuItem value="last-7-days">Last 7 Days</MenuItem>
                <MenuItem value="last-30-days">Last 30 Days</MenuItem>
                <MenuItem value="custom">Custom Date</MenuItem>
                <MenuItem value="customRange">Custom Range</MenuItem>
              </Select>
            </FormControl>

            {dateRange === 'custom' && (
              <TextField
                size="small"
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                sx={{ width: 170 }}
              />
            )}

            {dateRange === 'customRange' && (
              <>
                <TextField
                  size="small"
                  type="date"
                  label="Start"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: 170 }}
                />
                <TextField
                  size="small"
                  type="date"
                  label="End"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: 170 }}
                />
              </>
            )}

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Location</InputLabel>
              <Select
                value={selectedLocationId}
                label="Location"
                onChange={(e: SelectChangeEvent) => setSelectedLocationId(e.target.value)}
                disabled={loadingLocations}
              >
                <MenuItem value="all">All Locations</MenuItem>
                {locations
                  .filter((l) => l.name)
                  .map((l) => (
                    <MenuItem key={l.id} value={l.id}>
                      {l.name}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>

            {(dateRange === 'custom' || dateRange === 'customRange') && (
              <Button variant="contained" size="small" onClick={() => void refetch()}>
                Search
              </Button>
            )}

            <IconButton onClick={() => void refetch()} size="small" title="Refresh">
              <RefreshIcon />
            </IconButton>
          </Box>
        </Paper>

        {/* Data grid */}
        <Paper sx={{ height: 'calc(100vh - 340px)', width: '100%' }}>
          <DataGridPro
            rows={rows}
            columns={columns}
            loading={isLoading}
            density="compact"
            pagination
            pageSizeOptions={[25, 50, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
            slots={{ toolbar: CustomToolbar }}
            disableRowSelectionOnClick
            sx={{
              '& .MuiDataGrid-cell': { py: 0.5 },
              border: 'none',
            }}
          />
        </Paper>
      </Box>
    </PageContainer>
  );
}
