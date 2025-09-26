import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Box,
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
import { DataGridPro, GridColDef, GridRenderCellParams } from '@mui/x-data-grid-pro';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { VisitStatusLabel } from 'utils';
import { getIncompleteEncountersReport } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import PageContainer from '../../layout/PageContainer';

interface IncompleteEncounterRow {
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
}

type DateRangeFilter = 'today' | 'yesterday' | 'last-7-days' | 'last-30-days';

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

const getDateRange = (filter: DateRangeFilter): { start: string; end: string } => {
  const now = DateTime.now();
  const today = now.startOf('day');

  switch (filter) {
    case 'today': {
      return {
        start: today.toISO(),
        end: today.endOf('day').toISO(),
      };
    }
    case 'yesterday': {
      const yesterday = today.minus({ days: 1 });
      return {
        start: yesterday.toISO(),
        end: yesterday.endOf('day').toISO(),
      };
    }
    case 'last-7-days': {
      return {
        start: today.minus({ days: 7 }).toISO(),
        end: now.toISO(),
      };
    }
    case 'last-30-days': {
      return {
        start: today.minus({ days: 30 }).toISO(),
        end: now.toISO(),
      };
    }
    default: {
      return {
        start: today.toISO(),
        end: today.endOf('day').toISO(),
      };
    }
  }
};

const useIncompleteEncounters = (
  dateRange: DateRangeFilter
): ReturnType<typeof useQuery<IncompleteEncounterRow[], Error>> => {
  const { oystehrZambda } = useApiClients();
  const { start, end } = getDateRange(dateRange);

  return useQuery({
    queryKey: ['incomplete-encounters', dateRange, start, end],
    queryFn: async (): Promise<IncompleteEncounterRow[]> => {
      if (!oystehrZambda) {
        throw new Error('Oystehr client not available');
      }

      // Call the Zambda function to get incomplete encounters
      const response = await getIncompleteEncountersReport(oystehrZambda, {
        dateRange: { start, end },
      });

      // Transform the response to match our display requirements
      const processedEncounters: IncompleteEncounterRow[] = response.encounters.map((encounter) => {
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
        };
      });

      return processedEncounters.sort((a, b) => {
        // Sort by appointment start time - we need to get the original ISO time from the API response
        const aTime = response.encounters.find((e) => e.appointmentId === a.appointmentId)?.appointmentStart || '';
        const bTime = response.encounters.find((e) => e.appointmentId === b.appointmentId)?.appointmentStart || '';
        return DateTime.fromISO(aTime).toMillis() - DateTime.fromISO(bTime).toMillis();
      });
    },
    enabled: Boolean(oystehrZambda),
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export default function IncompleteEncounters(): React.ReactElement {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRangeFilter>('today');

  const { data: encounters = [], isLoading, error, refetch } = useIncompleteEncounters(dateRange);

  const handleBack = (): void => {
    navigate('/reports');
  };

  const handleDateRangeChange = (event: SelectChangeEvent<DateRangeFilter>): void => {
    setDateRange(event.target.value as DateRangeFilter);
  };

  const handleRefresh = (): void => {
    void refetch();
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

          // For now, only handle in-person visits
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

          // For telemed or visits without location, just show the time without link
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
            <AssignmentLateIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h4" component="h1" color="primary.dark" fontWeight={600}>
              Incomplete Encounters
            </Typography>
          </Box>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Date Range</InputLabel>
              <Select value={dateRange} label="Date Range" onChange={handleDateRangeChange}>
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="yesterday">Yesterday</MenuItem>
                <MenuItem value="last-7-days">Last 7 Days</MenuItem>
                <MenuItem value="last-30-days">Last 30 Days</MenuItem>
              </Select>
            </FormControl>
            <IconButton onClick={handleRefresh} disabled={isLoading}>
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          This report shows encounters that are not in a terminal state (completed, cancelled, or no show). These
          encounters may need attention or follow-up.
        </Typography>

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
              No incomplete encounters found for the selected date range
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
              Try selecting a different date range or check if there are any active encounters
            </Typography>
          </Box>
        )}
      </Box>
    </PageContainer>
  );
}
