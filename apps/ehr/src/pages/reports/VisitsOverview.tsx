import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssessmentIcon from '@mui/icons-material/Assessment';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { DateTime } from 'luxon';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import type { VisitsOverviewReportZambdaOutput } from 'utils';
import { getVisitsOverviewReport } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import PageContainer from '../../layout/PageContainer';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

export default function VisitsOverview(): React.ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<VisitsOverviewReportZambdaOutput | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [customDate, setCustomDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [customStartDate, setCustomStartDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));

  const handleBack = (): void => {
    navigate('/reports');
  };

  const getDateRange = useCallback(
    (filter: string, selectedDate?: string): { start: string; end: string } => {
      const now = DateTime.now().setZone('America/New_York');

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
        case 'custom': {
          if (!selectedDate) return { start: '', end: '' };
          const customDateTime = DateTime.fromISO(selectedDate).setZone('America/New_York');
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

      try {
        const { start, end } = getDateRange(filter, customDate);
        if (!oystehrZambda) {
          throw new Error('Oystehr client not available');
        }

        const response = await getVisitsOverviewReport(oystehrZambda, {
          dateRange: { start, end },
        });

        setReportData(response);
      } catch (err) {
        console.error('Error fetching visits overview report:', err);
        setError('Failed to load visits overview report. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [getDateRange, oystehrZambda, customDate]
  );

  useEffect(() => {
    void fetchReport(dateFilter);
  }, [dateFilter, fetchReport]);

  const handleDateFilterChange = (event: SelectChangeEvent<string>): void => {
    const newFilter = event.target.value;
    setDateFilter(newFilter);
    void fetchReport(newFilter);
  };

  const handleCustomDateChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const newDate = event.target.value;
    setCustomDate(newDate);
    if (dateFilter === 'custom') {
      void fetchReport('custom');
    }
  };

  const handleCustomStartDateChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const newDate = event.target.value;
    setCustomStartDate(newDate);
    if (dateFilter === 'customRange') {
      void fetchReport('customRange');
    }
  };

  const handleCustomEndDateChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const newDate = event.target.value;
    setCustomEndDate(newDate);
    if (dateFilter === 'customRange') {
      void fetchReport('customRange');
    }
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
        case 'custom':
          return `Custom date (${DateTime.fromISO(customDate).toFormat('MMM dd, yyyy')})`;
        case 'customRange':
          return `Custom range (${DateTime.fromISO(customStartDate).toFormat('MMM dd')} - ${DateTime.fromISO(
            customEndDate
          ).toFormat('MMM dd, yyyy')})`;
        default:
          return 'Today';
      }
    },
    [customDate, customStartDate, customEndDate]
  );

  // Prepare statistics data
  const statisticsData = useMemo(() => {
    if (!reportData) return [];

    return reportData.appointmentTypes
      .filter((type) => type.count > 0) // Only show types that have appointments
      .sort((a, b) => b.count - a.count); // Sort by count descending
  }, [reportData]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!reportData || !reportData.dailyVisits.length) {
      return {
        labels: [],
        datasets: [],
      };
    }

    const labels = reportData.dailyVisits.map((day) => DateTime.fromISO(day.date).toFormat('MMM dd'));

    return {
      labels,
      datasets: [
        {
          label: 'In-Person',
          data: reportData.dailyVisits.map((day) => day.inPerson),
          borderColor: 'rgb(53, 162, 235)',
          backgroundColor: 'rgba(53, 162, 235, 0.2)',
          borderWidth: 2,
          fill: false,
        },
        {
          label: 'Telemed',
          data: reportData.dailyVisits.map((day) => day.telemed),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          borderWidth: 2,
          fill: false,
        },
      ],
    };
  }, [reportData]);

  // Prepare location chart data
  const locationChartData = useMemo(() => {
    if (!reportData || !reportData.locationVisits.length) {
      return {
        labels: [],
        datasets: [],
      };
    }

    const labels = reportData.locationVisits.map((location) => location.locationName);

    return {
      labels,
      datasets: [
        {
          label: 'In-Person',
          data: reportData.locationVisits.map((location) => location.inPerson),
          backgroundColor: 'rgba(53, 162, 235, 0.8)',
          borderColor: 'rgb(53, 162, 235)',
          borderWidth: 1,
        },
        {
          label: 'Telemed',
          data: reportData.locationVisits.map((location) => location.telemed),
          backgroundColor: 'rgba(255, 99, 132, 0.8)',
          borderColor: 'rgb(255, 99, 132)',
          borderWidth: 1,
        },
      ],
    };
  }, [reportData]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: `Daily Visits by Type - ${getDateRangeLabel(dateFilter)}`,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
          },
        },
      },
    }),
    [dateFilter, getDateRangeLabel]
  );

  const locationChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: `Visits by Location - ${getDateRangeLabel(dateFilter)}`,
        },
      },
      scales: {
        x: {
          stacked: true,
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            stepSize: 1,
          },
        },
      },
    }),
    [dateFilter, getDateRangeLabel]
  );

  const practitionerColumns: GridColDef[] = useMemo(
    () => [
      {
        field: 'practitionerName',
        headerName: 'Provider Name',
        width: 200,
        sortable: true,
      },
      {
        field: 'role',
        headerName: 'Role',
        width: 150,
        sortable: true,
      },
      {
        field: 'inPerson',
        headerName: 'In-Person',
        width: 120,
        sortable: true,
        type: 'number',
      },
      {
        field: 'telemed',
        headerName: 'Telemed',
        width: 120,
        sortable: true,
        type: 'number',
      },
      {
        field: 'total',
        headerName: 'Total',
        width: 100,
        sortable: true,
        type: 'number',
      },
    ],
    []
  );

  const practitionerRows = useMemo(() => {
    if (!reportData?.practitionerVisits) return [];

    return reportData.practitionerVisits.map((practitioner) => ({
      id: `${practitioner.practitionerId}-${practitioner.role}`,
      practitionerName: practitioner.practitionerName,
      role: practitioner.role,
      inPerson: practitioner.inPerson,
      telemed: practitioner.telemed,
      total: practitioner.total,
    }));
  }, [reportData]);

  return (
    <PageContainer>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleBack} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AssessmentIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h4" component="h1" color="primary.dark" fontWeight={600}>
              Visits Overview Report
            </Typography>
          </Box>
        </Box>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Overview of appointments by type for {getDateRangeLabel(dateFilter).toLowerCase()}.
        </Typography>

        {/* Date Filter */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Date Range</InputLabel>
            <Select value={dateFilter} label="Date Range" onChange={handleDateFilterChange} disabled={loading}>
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="yesterday">Yesterday</MenuItem>
              <MenuItem value="last7days">Last 7 days</MenuItem>
              <MenuItem value="last30days">Last 30 days</MenuItem>
              <MenuItem value="custom">Custom Date</MenuItem>
              <MenuItem value="customRange">Custom Date Range</MenuItem>
            </Select>
          </FormControl>

          {dateFilter === 'custom' && (
            <TextField
              type="date"
              size="small"
              value={customDate}
              onChange={handleCustomDateChange}
              disabled={loading}
              sx={{ minWidth: 160 }}
              InputLabelProps={{
                shrink: true,
              }}
            />
          )}

          {dateFilter === 'customRange' && (
            <>
              <TextField
                type="date"
                size="small"
                label="Start Date"
                value={customStartDate}
                onChange={handleCustomStartDateChange}
                disabled={loading}
                sx={{ minWidth: 160 }}
                InputLabelProps={{
                  shrink: true,
                }}
              />
              <TextField
                type="date"
                size="small"
                label="End Date"
                value={customEndDate}
                onChange={handleCustomEndDateChange}
                disabled={loading}
                sx={{ minWidth: 160 }}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </>
          )}

          <Button variant="outlined" onClick={() => void fetchReport(dateFilter)} disabled={loading}>
            Refresh
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && reportData && (
          <Box>
            {/* Summary and Statistics Cards Row */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2, mb: 4 }}>
              {/* Total Appointments Card */}
              <Card>
                <CardContent>
                  <Typography variant="h6" color="primary.main" gutterBottom>
                    Total Appointments
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" sx={{ mb: 1 }}>
                    {reportData.totalAppointments}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {getDateRangeLabel(dateFilter)}
                  </Typography>
                </CardContent>
              </Card>

              {/* Appointments by Type Cards */}
              {statisticsData.length > 0 &&
                statisticsData.map((typeData, index) => (
                  <Card key={index}>
                    <CardContent>
                      <Typography variant="h6" color="primary.main" gutterBottom>
                        {typeData.type}
                      </Typography>
                      <Typography variant="h3" fontWeight="bold" sx={{ mb: 1 }}>
                        {typeData.count}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {typeData.percentage}% of total appointments
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
            </Box>

            {/* Chart Section */}
            {reportData.dailyVisits.length > 0 && (
              <Card sx={{ mb: 4 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 3 }}>
                    Daily Visits by Type
                  </Typography>
                  <Box sx={{ height: 400 }}>
                    <Line data={chartData} options={chartOptions} />
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* Location Chart Section */}
            {reportData.locationVisits.length > 0 && (
              <Card sx={{ mb: 4 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 3 }}>
                    Visits by Location
                  </Typography>
                  <Box sx={{ height: 400 }}>
                    <Bar data={locationChartData} options={locationChartOptions} />
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* Practitioner Table Section */}
            {reportData && practitionerRows.length > 0 && (
              <Card sx={{ mb: 4 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 3 }}>
                    Visits by Provider
                  </Typography>
                  <Box sx={{ height: 400, width: '100%' }}>
                    <DataGrid
                      rows={practitionerRows}
                      columns={practitionerColumns}
                      initialState={{
                        pagination: {
                          paginationModel: { pageSize: 10 },
                        },
                        sorting: {
                          sortModel: [{ field: 'total', sort: 'desc' }],
                        },
                      }}
                      pageSizeOptions={[5, 10, 25]}
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
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* No Data Message */}
            {statisticsData.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h6" color="text.secondary">
                  No appointments found for the selected period
                </Typography>
                <Typography variant="body2" color="text.disabled" sx={{ mt: 2 }}>
                  Try selecting a different date range or check back later.
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </PageContainer>
  );
}
