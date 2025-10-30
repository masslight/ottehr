import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PsychologyIcon from '@mui/icons-material/Psychology';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
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
import { VisitStatusLabel } from 'utils';
import { getAiAssistedEncountersReport } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import PageContainer from '../../layout/PageContainer';

interface AiAssistedEncounterRow {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  dateOfBirth: string;
  visitStatus: VisitStatusLabel;
  appointmentTime: string;
  appointmentStart: string;
  location?: string;
  locationId?: string;
  attendingProvider?: string;
  visitType?: string;
  reason?: string;
  aiType?: string;
}

type DateRangeFilter = 'today' | 'yesterday' | 'last-7-days' | 'last-7-days-excluding-today' | 'last-30-days';

const getStatusColor = (
  status: VisitStatusLabel
): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
  switch (status) {
    case 'pending':
      return 'default';
    case 'arrived':
      return 'info';
    case 'intake':
      return 'primary';
    case 'ready':
    case 'ready for provider':
      return 'warning';
    case 'provider':
      return 'secondary';
    case 'discharged':
      return 'success';
    case 'awaiting supervisor approval':
      return 'warning';
    default:
      return 'error';
  }
};

const useAiAssistedEncounters = (
  dateRange: DateRangeFilter,
  start: string,
  end: string,
  selectedLocationId: string
): ReturnType<typeof useQuery<AiAssistedEncounterRow[], Error>> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['ai-assisted-encounters', dateRange, start, end, selectedLocationId],
    queryFn: async (): Promise<AiAssistedEncounterRow[]> => {
      if (!oystehrZambda) {
        throw new Error('Oystehr client not available');
      }

      // Build location filter if a location is selected
      const locationIds = selectedLocationId !== 'all' ? [selectedLocationId] : undefined;

      // Call the Zambda function to get AI-assisted encounters
      const response = await getAiAssistedEncountersReport(oystehrZambda, {
        dateRange: { start, end },
        locationIds,
      });

      // Transform the response to match our display requirements
      const processedEncounters: AiAssistedEncounterRow[] = response.encounters.map((encounter) => {
        const appointmentTime = encounter.appointmentStart
          ? DateTime.fromISO(encounter.appointmentStart).toFormat('MM/dd/yyyy HH:mm a')
          : 'Unknown';

        return {
          id: encounter.appointmentId,
          appointmentId: encounter.appointmentId,
          patientId: encounter.patientId,
          patientName: encounter.patientName,
          dateOfBirth: encounter.dateOfBirth,
          visitStatus: encounter.visitStatus as VisitStatusLabel,
          appointmentTime,
          appointmentStart: encounter.appointmentStart,
          location: encounter.location,
          locationId: encounter.locationId,
          attendingProvider: encounter.attendingProvider,
          visitType: encounter.visitType,
          reason: encounter.reason,
          aiType: encounter.aiType,
        };
      });

      return processedEncounters.sort((a, b) => {
        const aTime = a.appointmentStart;
        const bTime = b.appointmentStart;
        return DateTime.fromISO(bTime).toMillis() - DateTime.fromISO(aTime).toMillis();
      });
    },
    enabled: Boolean(oystehrZambda),
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export default function AiAssistedEncounters(): React.ReactElement {
  const navigate = useNavigate();
  const { oystehr } = useApiClients();
  const [dateRange, setDateRange] = useState<DateRangeFilter>('today');
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState<boolean>(true);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');

  // Fetch locations on component mount
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

        const locationsList = locationResults.unbundle();
        setLocations(locationsList);
      } catch (err) {
        console.error('Error fetching locations:', err);
      } finally {
        setLoadingLocations(false);
      }
    };

    void fetchLocations();
  }, [oystehr]);

  const getDateRange = useCallback((filter: DateRangeFilter): { start: string; end: string } => {
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
      case 'last-7-days': {
        return {
          start: today.minus({ days: 6 }).toISO() ?? '',
          end: today.endOf('day').toISO() ?? '',
        };
      }
      case 'last-7-days-excluding-today': {
        return {
          start: today.minus({ days: 6 }).toISO() ?? '',
          end: today.minus({ days: 1 }).endOf('day').toISO() ?? '',
        };
      }
      case 'last-30-days': {
        return {
          start: today.minus({ days: 29 }).toISO() ?? '',
          end: today.endOf('day').toISO() ?? '',
        };
      }
      default: {
        return {
          start: today.toISO() ?? '',
          end: today.endOf('day').toISO() ?? '',
        };
      }
    }
  }, []);

  const { start, end } = getDateRange(dateRange);
  const {
    data: encounters = [],
    isLoading,
    error,
    refetch,
  } = useAiAssistedEncounters(dateRange, start, end, selectedLocationId);

  const handleBack = (): void => {
    navigate('/reports');
  };

  const handleDateRangeChange = (event: SelectChangeEvent<DateRangeFilter>): void => {
    setDateRange(event.target.value as DateRangeFilter);
  };

  const handleLocationFilterChange = (event: SelectChangeEvent<string>): void => {
    const newLocationId = event.target.value;
    setSelectedLocationId(newLocationId);
  };

  const handleRefresh = (): void => {
    void refetch();
  };

  // Custom toolbar component with export functionality
  const CustomToolbar = (): React.ReactElement => {
    return (
      <GridToolbarContainer>
        <GridToolbarExport csvOptions={{ fileName: 'ai-assisted-encounters-report' }} />
      </GridToolbarContainer>
    );
  };

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'appointmentId',
        headerName: 'Appointment ID',
        width: 320,
        sortable: true,
        renderCell: (params: GridRenderCellParams) => {
          const visitType = params.row.visitType;
          const appointmentId = params.value;

          const linkPath =
            visitType === 'Telemed'
              ? `/telemed/appointments/${appointmentId}`
              : `/in-person/${appointmentId}/progress-note`;

          return (
            <Link
              to={linkPath}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#1976d2',
                textDecoration: 'underline',
                fontFamily: 'monospace',
              }}
            >
              {appointmentId}
            </Link>
          );
        },
      },
      {
        field: 'aiType',
        headerName: 'AI Type',
        width: 250,
        sortable: true,
        renderCell: (params: GridRenderCellParams) => {
          const aiType = params.value as string;
          if (!aiType) return <span>-</span>;

          // Determine chip color based on AI type
          let color: 'primary' | 'secondary' | 'success' = 'primary';
          if (aiType === 'ambient scribe') {
            color = 'secondary';
          } else if (aiType === 'patient HPI chatbot & ambient scribe') {
            color = 'success';
          }

          return <Chip label={aiType} color={color} size="small" variant="outlined" />;
        },
      },
      {
        field: 'visitStatus',
        headerName: 'Status',
        width: 160,
        sortable: true,
        renderCell: (params: GridRenderCellParams) => (
          <Chip
            label={params.value}
            color={getStatusColor(params.value as VisitStatusLabel)}
            size="small"
            variant="outlined"
          />
        ),
      },
      {
        field: 'appointmentTime',
        headerName: 'Appointment Time',
        width: 180,
        sortable: true,
        renderCell: (params: GridRenderCellParams) => {
          const visitType = params.row.visitType;
          const locationId = params.row.locationId;
          const appointmentTime = params.value;

          // Extract date from appointment start for the search date parameter
          const appointmentStart = params.row.appointmentStart;
          const searchDate = appointmentStart
            ? DateTime.fromISO(appointmentStart).toFormat('yyyy-MM-dd')
            : DateTime.now().toFormat('yyyy-MM-dd');

          // Handle different visit types
          if (visitType === 'In-Person' && locationId) {
            const trackingBoardPath = `/visits?locationID=${locationId}&visitType=walk-in%2Cpre-booked%2Cpost-telemed&groups=&searchDate=${searchDate}`;

            return (
              <Link
                to={trackingBoardPath}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#1976d2',
                  textDecoration: 'underline',
                }}
              >
                {appointmentTime}
              </Link>
            );
          }

          if (visitType === 'Telemed') {
            return (
              <Link
                to="/telemed/appointments"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#1976d2',
                  textDecoration: 'underline',
                }}
              >
                {appointmentTime}
              </Link>
            );
          }

          // For visits without location or unknown type, just show the time without link
          return <span>{appointmentTime}</span>;
        },
      },
      {
        field: 'location',
        headerName: 'Location',
        width: 150,
        sortable: true,
      },
      {
        field: 'attendingProvider',
        headerName: 'Attending Provider',
        width: 200,
        sortable: true,
      },
      {
        field: 'visitType',
        headerName: 'Visit Type',
        width: 120,
        sortable: true,
      },
      {
        field: 'patientName',
        headerName: 'Patient Name',
        width: 200,
        sortable: true,
      },
      {
        field: 'reason',
        headerName: 'Reason',
        width: 200,
        sortable: true,
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
            <PsychologyIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h4" component="h1" color="primary.dark" fontWeight={600}>
              AI-assisted Encounters
            </Typography>
          </Box>
        </Box>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          This report shows encounters that have associated DocumentReference resources with AI-related types. Filter by
          date range and location to view appointments with AI-assisted documentation. Click an appointment ID to
          navigate to the specific appointment chart.
        </Typography>

        {/* Date and Location Filters */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Date Range</InputLabel>
            <Select value={dateRange} label="Date Range" onChange={handleDateRangeChange}>
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="yesterday">Yesterday</MenuItem>
              <MenuItem value="last-7-days">Last 7 Days</MenuItem>
              <MenuItem value="last-7-days-excluding-today">Last 7 Days (Excluding Today)</MenuItem>
              <MenuItem value="last-30-days">Last 30 Days</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Location</InputLabel>
            <Select
              value={selectedLocationId}
              label="Location"
              onChange={handleLocationFilterChange}
              disabled={loadingLocations}
            >
              <MenuItem value="all">All Locations</MenuItem>
              {locations
                .filter((loc) => loc.name)
                .map((location) => (
                  <MenuItem key={location.id} value={location.id}>
                    {location.name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

          <Button variant="outlined" onClick={handleRefresh} disabled={isLoading} startIcon={<RefreshIcon />}>
            Refresh
          </Button>
        </Box>

        <Paper sx={{ height: 600, width: '100%' }}>
          <DataGridPro
            rows={encounters}
            columns={columns}
            loading={isLoading}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 25 },
              },
              sorting: {
                sortModel: [{ field: 'appointmentTime', sort: 'desc' }],
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
              Error loading encounters: {error instanceof Error ? error.message : 'Unknown error'}
            </Typography>
          </Box>
        )}

        {!isLoading && encounters.length === 0 && !error && (
          <Box sx={{ mt: 2, p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              No AI-assisted encounters found for the selected filters
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
              Try selecting a different date range or location, or check if there are any encounters with AI-generated
              documents
            </Typography>
          </Box>
        )}
      </Box>
    </PageContainer>
  );
}
