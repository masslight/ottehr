import ArrowBackIcon from '@mui/icons-material/ArrowBack';
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
  Select,
  SelectChangeEvent,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef, GridToolbarContainer, GridToolbarExport } from '@mui/x-data-grid';
import { DateTime } from 'luxon';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RecentPatientsReportZambdaOutput } from 'utils';
import { getRecentPatientsReport } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import PageContainer from '../../layout/PageContainer';

// Custom toolbar for DataGrid with export functionality
function CustomToolbar(): React.ReactElement {
  return (
    <GridToolbarContainer>
      <GridToolbarExport />
    </GridToolbarContainer>
  );
}

export default function RecentPatients(): React.ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<RecentPatientsReportZambdaOutput | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [locationFilter, setLocationFilter] = useState<string>('all');

  const handleBack = (): void => {
    navigate('/reports');
  };

  const getDateRange = useCallback(
    (filter: string): { start: string; end: string } => {
      const now = DateTime.now();

      switch (filter) {
        case 'today':
          return {
            start: now.startOf('day').toISO() ?? '',
            end: now.endOf('day').toISO() ?? '',
          };
        case 'yesterday': {
          const yesterday = now.minus({ days: 1 });
          return {
            start: yesterday.startOf('day').toISO() ?? '',
            end: yesterday.endOf('day').toISO() ?? '',
          };
        }
        case 'last7days':
          return {
            start: now.minus({ days: 6 }).startOf('day').toISO() ?? '',
            end: now.endOf('day').toISO() ?? '',
          };
        case 'last30days':
          return {
            start: now.minus({ days: 29 }).startOf('day').toISO() ?? '',
            end: now.endOf('day').toISO() ?? '',
          };
        case 'customRange': {
          const startDateTime = DateTime.fromISO(customStartDate);
          const endDateTime = DateTime.fromISO(customEndDate);
          return {
            start: startDateTime.startOf('day').toISO() ?? '',
            end: endDateTime.endOf('day').toISO() ?? '',
          };
        }
        default:
          return {
            start: now.startOf('day').toISO() ?? '',
            end: now.endOf('day').toISO() ?? '',
          };
      }
    },
    [customStartDate, customEndDate]
  );

  const fetchReport = useCallback(
    async (filter: string): Promise<void> => {
      setLoading(true);
      setError(null);
      setReportData(null);

      try {
        const { start, end } = getDateRange(filter);
        if (!oystehrZambda) {
          throw new Error('Oystehr client not available');
        }

        const response = await getRecentPatientsReport(oystehrZambda, {
          dateRange: { start, end },
          locationId: locationFilter !== 'all' ? locationFilter : undefined,
        });

        setReportData(response);
      } catch (err) {
        console.error('Error fetching recent patients report:', err);
        setError('Failed to load recent patients report. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [getDateRange, oystehrZambda, locationFilter]
  );

  useEffect(() => {
    void fetchReport(dateFilter);
  }, [dateFilter, fetchReport]);

  // Trigger fetch when custom date range changes
  useEffect(() => {
    if (dateFilter === 'customRange') {
      void fetchReport('customRange');
    }
  }, [customStartDate, customEndDate, dateFilter, fetchReport]);

  const handleDateFilterChange = (event: SelectChangeEvent<string>): void => {
    const newFilter = event.target.value;
    setDateFilter(newFilter);
  };

  const handleLocationFilterChange = (event: SelectChangeEvent<string>): void => {
    const newLocation = event.target.value;
    setLocationFilter(newLocation);
  };

  const handleCustomStartDateChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const newDate = event.target.value;
    setCustomStartDate(newDate);
  };

  const handleCustomEndDateChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const newDate = event.target.value;
    setCustomEndDate(newDate);
  };

  const getDateRangeLabel = useCallback(
    (filter: string): string => {
      switch (filter) {
        case 'today':
          return 'Today';
        case 'yesterday':
          return 'Yesterday';
        case 'last7days':
          return 'Last 7 days';
        case 'last30days':
          return 'Last 30 days';
        case 'customRange':
          return `${DateTime.fromISO(customStartDate).toFormat('MMM dd')} - ${DateTime.fromISO(customEndDate).toFormat(
            'MMM dd, yyyy'
          )}`;
        default:
          return 'Today';
      }
    },
    [customStartDate, customEndDate]
  );

  // Define DataGrid columns
  const columns = useMemo<GridColDef[]>(
    () =>
      [
        {
          field: 'firstName',
          headerName: 'First Name',
          flex: 1,
          minWidth: 120,
          sortable: true,
        },
        {
          field: 'lastName',
          headerName: 'Last Name',
          flex: 1,
          minWidth: 120,
          sortable: true,
        },
        {
          field: 'phoneNumber',
          headerName: 'Phone Number',
          flex: 1,
          minWidth: 140,
          sortable: true,
          renderCell: (params) => {
            const value = params.value as string;
            if (!value) return '';
            // Format phone number if it's a 10-digit number
            const cleaned = value.replace(/\D/g, '');
            if (cleaned.length === 10) {
              return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
            }
            return value;
          },
        },
        {
          field: 'email',
          headerName: 'Email',
          flex: 1.5,
          minWidth: 200,
          sortable: true,
        },
        {
          field: 'serviceCategory',
          headerName: 'In-person / Telemed',
          flex: 1,
          minWidth: 150,
          sortable: true,
        },
        {
          field: 'patientStatus',
          headerName: 'Patient Status',
          flex: 0.8,
          minWidth: 130,
          sortable: true,
          renderCell: (params) => (
            <Chip
              label={params.value === 'new' ? 'New' : 'Existing'}
              color={params.value === 'new' ? 'success' : 'primary'}
              size="small"
              variant="outlined"
            />
          ),
        },
        {
          field: 'mostRecentVisitDate',
          headerName: 'Most Recent Visit',
          flex: 1,
          minWidth: 150,
          sortable: true,
        },
      ] as GridColDef[],
    []
  );

  // Transform data to flatten nested fields for DataGrid
  const transformedRows = useMemo(() => {
    if (!reportData) return [];

    return reportData.patients.map((patient) => {
      let serviceCategory = patient.mostRecentVisit?.serviceCategory || '';

      // Transform service category display names
      if (serviceCategory === 'in-person-service-mode') {
        serviceCategory = 'In-person';
      } else if (serviceCategory === 'virtual-service-mode') {
        serviceCategory = 'Telemed';
      }

      return {
        ...patient,
        serviceCategory,
        mostRecentVisitDate: patient.mostRecentVisit?.date
          ? DateTime.fromISO(patient.mostRecentVisit.date).toFormat('MMM dd, yyyy')
          : '',
      };
    });
  }, [reportData]);

  return (
    <PageContainer>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={handleBack} aria-label="back to reports">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            Recent Patients Report
          </Typography>
        </Box>

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel id="date-filter-label">Date Range</InputLabel>
            <Select
              labelId="date-filter-label"
              id="date-filter"
              value={dateFilter}
              label="Date Range"
              onChange={handleDateFilterChange}
            >
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="yesterday">Yesterday</MenuItem>
              <MenuItem value="last7days">Last 7 Days</MenuItem>
              <MenuItem value="last30days">Last 30 Days</MenuItem>
              <MenuItem value="customRange">Custom Range</MenuItem>
            </Select>
          </FormControl>

          {dateFilter === 'customRange' && (
            <>
              <TextField
                label="Start Date"
                type="date"
                value={customStartDate}
                onChange={handleCustomStartDateChange}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="End Date"
                type="date"
                value={customEndDate}
                onChange={handleCustomEndDateChange}
                InputLabelProps={{ shrink: true }}
              />
            </>
          )}

          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel id="location-filter-label">Location</InputLabel>
            <Select
              labelId="location-filter-label"
              id="location-filter"
              value={locationFilter}
              label="Location"
              onChange={handleLocationFilterChange}
            >
              <MenuItem value="all">All Locations</MenuItem>
              {/* TODO: Add actual locations from API */}
            </Select>
          </FormControl>

          <Button variant="contained" onClick={() => fetchReport(dateFilter)} disabled={loading}>
            Generate Report
          </Button>
        </Box>

        {/* Error display */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Loading state */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Data Grid */}
        {!loading && reportData && (
          <Box sx={{ height: 600, width: '100%' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Patients for {getDateRangeLabel(dateFilter)}
            </Typography>
            <DataGrid
              rows={transformedRows}
              columns={columns}
              getRowId={(row) => row.patientId}
              initialState={{
                pagination: {
                  paginationModel: { pageSize: 25 },
                },
              }}
              pageSizeOptions={[10, 25, 50, 100]}
              slots={{
                toolbar: CustomToolbar,
              }}
              disableRowSelectionOnClick
              sx={{
                '& .MuiDataGrid-cell:focus': {
                  outline: 'none',
                },
                '& .MuiDataGrid-row:hover': {
                  cursor: 'pointer',
                },
              }}
            />
          </Box>
        )}

        {/* Empty state */}
        {!loading && reportData && reportData.patients.length === 0 && (
          <Box sx={{ textAlign: 'center', p: 4 }}>
            <Typography variant="h6" color="text.secondary">
              No patients found for the selected date range
            </Typography>
          </Box>
        )}
      </Box>
    </PageContainer>
  );
}
