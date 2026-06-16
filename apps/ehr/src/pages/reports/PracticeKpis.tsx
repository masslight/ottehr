import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import InsightsIcon from '@mui/icons-material/Insights';
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
import { DataGrid, GridColDef, GridToolbarContainer, GridToolbarExport } from '@mui/x-data-grid';
import { DateTime } from 'luxon';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PracticeKpisReportZambdaOutput } from 'utils';
import { getPracticeKpisReport } from '../../api/api';
import { encountersDataset } from '../../features/reports/adHoc/encountersDataset';
import { setAdHocSeed } from '../../features/reports/adHoc/seed';
import { useApiClients } from '../../hooks/useAppClients';
import PageContainer from '../../layout/PageContainer';

const DATE_FILTER_LABELS: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7days: 'Last 7 days',
  last30days: 'Last 30 days',
};

export default function PracticeKpis(): React.ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const [loading, setLoading] = useState<boolean>(false);
  const [seeding, setSeeding] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<PracticeKpisReportZambdaOutput | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('last7days');
  const [customDate, setCustomDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [customStartDate, setCustomStartDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));

  const handleBack = (): void => {
    navigate('/reports');
  };

  const getDateRange = useCallback(
    (filter: string, selectedDate?: string): { start: string; end: string } => {
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
        case 'custom': {
          if (!selectedDate) return { start: '', end: '' };
          const customDateTime = DateTime.fromISO(selectedDate);
          return {
            start: customDateTime.startOf('day').toISO() ?? '',
            end: customDateTime.endOf('day').toISO() ?? '',
          };
        }
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
            start: now.minus({ days: 6 }).startOf('day').toISO() ?? '',
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
        const { start, end } = getDateRange(filter, customDate);
        if (!oystehrZambda) {
          throw new Error('Oystehr client not available');
        }

        const response = await getPracticeKpisReport(oystehrZambda, {
          dateRange: { start, end },
        });

        setReportData(response);
      } catch (err) {
        console.error('Error fetching practice KPIs report:', err);
        setError('Failed to load practice KPIs report. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [getDateRange, oystehrZambda, customDate]
  );

  useEffect(() => {
    // Only auto-fetch for preset date filters (today, yesterday, etc.)
    // Custom date/range selections require the user to click Refresh
    if (dateFilter !== 'custom' && dateFilter !== 'customRange') {
      void fetchReport(dateFilter);
    }
  }, [dateFilter, fetchReport]);

  const handleDateFilterChange = (event: SelectChangeEvent<string>): void => {
    const newFilter = event.target.value;
    setDateFilter(newFilter);
    if (newFilter === 'custom' || newFilter === 'customRange') {
      setReportData(null);
    }
  };

  const handleCustomDateChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const newDate = event.target.value;
    setCustomDate(newDate);
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
        case 'custom':
          return `Custom date (${DateTime.fromISO(customDate).toFormat('MMM dd, yyyy')})`;
        case 'customRange':
          return `Custom range (${DateTime.fromISO(customStartDate).toFormat('MMM dd')} - ${DateTime.fromISO(
            customEndDate
          ).toFormat('MMM dd, yyyy')})`;
        default:
          return 'Last 7 days';
      }
    },
    [customDate, customStartDate, customEndDate]
  );

  // Define columns for the DataGrid
  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'locationName',
        headerName: 'Location',
        flex: 1,
        minWidth: 200,
      },
      {
        field: 'visitCount',
        headerName: 'Visit Count',
        flex: 0.5,
        minWidth: 120,
      },
      {
        field: 'arrivedToReadyAverage',
        headerName: 'Arrived to Ready Average (min)',
        flex: 1,
        minWidth: 240,
        valueFormatter: (params) => {
          if (params.value === null || params.value === undefined) {
            return '—';
          }
          return params.value.toFixed(2);
        },
      },
      {
        field: 'arrivedToReadyMedian',
        headerName: 'Arrived to Ready Median (min)',
        flex: 1,
        minWidth: 240,
        valueFormatter: (params) => {
          if (params.value === null || params.value === undefined) {
            return '—';
          }
          return params.value.toFixed(2);
        },
      },
      {
        field: 'arrivedToDischargedAverage',
        headerName: 'Arrived to Discharged Average (min)',
        flex: 1,
        minWidth: 270,
        valueFormatter: (params) => {
          if (params.value === null || params.value === undefined) {
            return '—';
          }
          return params.value.toFixed(2);
        },
      },
      {
        field: 'arrivedToDischargedMedian',
        headerName: 'Arrived to Discharged Median (min)',
        flex: 1,
        minWidth: 270,
        valueFormatter: (params) => {
          if (params.value === null || params.value === undefined) {
            return '—';
          }
          return params.value.toFixed(2);
        },
      },
      {
        field: 'arrivedToIntakeAverage',
        headerName: 'Arrived to Intake Average (min)',
        flex: 1,
        minWidth: 240,
        valueFormatter: (params) => {
          if (params.value === null || params.value === undefined) {
            return '—';
          }
          return params.value.toFixed(2);
        },
      },
      {
        field: 'arrivedToIntakeMedian',
        headerName: 'Arrived to Intake Median (min)',
        flex: 1,
        minWidth: 240,
        valueFormatter: (params) => {
          if (params.value === null || params.value === undefined) {
            return '—';
          }
          return params.value.toFixed(2);
        },
      },
      {
        field: 'arrivedToProviderAverage',
        headerName: 'Arrived to Provider Average (min)',
        flex: 1,
        minWidth: 250,
        valueFormatter: (params) => {
          if (params.value === null || params.value === undefined) {
            return '—';
          }
          return params.value.toFixed(2);
        },
      },
      {
        field: 'arrivedToProviderMedian',
        headerName: 'Arrived to Provider Median (min)',
        flex: 1,
        minWidth: 250,
        valueFormatter: (params) => {
          if (params.value === null || params.value === undefined) {
            return '—';
          }
          return params.value.toFixed(2);
        },
      },
      {
        field: 'arrivedToProviderUnder15Percent',
        headerName: '% Arrived to Provider < 15 min',
        flex: 1,
        minWidth: 250,
        valueFormatter: (params) => {
          if (params.value === null || params.value === undefined) {
            return '—';
          }
          return `${params.value.toFixed(1)}%`;
        },
      },
      {
        field: 'arrivedToProviderUnder45Percent',
        headerName: '% Arrived to Provider < 45 min',
        flex: 1,
        minWidth: 250,
        valueFormatter: (params) => {
          if (params.value === null || params.value === undefined) {
            return '—';
          }
          return `${params.value.toFixed(1)}%`;
        },
      },
      {
        field: 'readyToIntakeAverage',
        headerName: 'Ready to Intake Average (min)',
        flex: 1,
        minWidth: 230,
        valueFormatter: (params) => {
          if (params.value === null || params.value === undefined) {
            return '—';
          }
          return params.value.toFixed(2);
        },
      },
      {
        field: 'readyToIntakeMedian',
        headerName: 'Ready to Intake Median (min)',
        flex: 1,
        minWidth: 230,
        valueFormatter: (params) => {
          if (params.value === null || params.value === undefined) {
            return '—';
          }
          return params.value.toFixed(2);
        },
      },
      {
        field: 'intakeToProviderAverage',
        headerName: 'Intake to Provider Average (min)',
        flex: 1,
        minWidth: 240,
        valueFormatter: (params) => {
          if (params.value === null || params.value === undefined) {
            return '—';
          }
          return params.value.toFixed(2);
        },
      },
      {
        field: 'intakeToProviderMedian',
        headerName: 'Intake to Provider Median (min)',
        flex: 1,
        minWidth: 240,
        valueFormatter: (params) => {
          if (params.value === null || params.value === undefined) {
            return '—';
          }
          return params.value.toFixed(2);
        },
      },
      {
        field: 'providerToDischargedAverage',
        headerName: 'Provider to Discharged Average (min)',
        flex: 1,
        minWidth: 270,
        valueFormatter: (params) => {
          if (params.value === null || params.value === undefined) {
            return '—';
          }
          return params.value.toFixed(2);
        },
      },
      {
        field: 'providerToDischargedMedian',
        headerName: 'Provider to Discharged Median (min)',
        flex: 1,
        minWidth: 270,
        valueFormatter: (params) => {
          if (params.value === null || params.value === undefined) {
            return '—';
          }
          return params.value.toFixed(2);
        },
      },
      {
        field: 'onTimePercent',
        headerName: '% On-Time',
        flex: 1,
        minWidth: 150,
        valueFormatter: (params) => {
          if (params.value === null || params.value === undefined) {
            return '—';
          }
          return `${params.value.toFixed(1)}%`;
        },
      },
      {
        field: 'bookAheadPercent',
        headerName: '% Book Ahead',
        flex: 1,
        minWidth: 150,
        valueFormatter: (params) => {
          if (params.value === null || params.value === undefined) {
            return '—';
          }
          return `${params.value.toFixed(1)}%`;
        },
      },
      {
        field: 'walkInPercent',
        headerName: '% Walk-In',
        flex: 1,
        minWidth: 150,
        valueFormatter: (params) => {
          if (params.value === null || params.value === undefined) {
            return '—';
          }
          return `${params.value.toFixed(1)}%`;
        },
      },
    ],
    []
  );

  // Prepare rows for the DataGrid
  const rows = useMemo(() => {
    if (!reportData?.locations) return [];
    return reportData.locations.map((location, index) => ({
      id: location.locationId || index,
      locationName: location.locationName,
      arrivedToReadyAverage: location.arrivedToReadyAverage,
      arrivedToReadyMedian: location.arrivedToReadyMedian,
      arrivedToDischargedAverage: location.arrivedToDischargedAverage,
      arrivedToDischargedMedian: location.arrivedToDischargedMedian,
      arrivedToIntakeAverage: location.arrivedToIntakeAverage,
      arrivedToIntakeMedian: location.arrivedToIntakeMedian,
      readyToIntakeAverage: location.readyToIntakeAverage,
      readyToIntakeMedian: location.readyToIntakeMedian,
      intakeToProviderAverage: location.intakeToProviderAverage,
      intakeToProviderMedian: location.intakeToProviderMedian,
      arrivedToProviderAverage: location.arrivedToProviderAverage,
      arrivedToProviderMedian: location.arrivedToProviderMedian,
      arrivedToProviderUnder15Percent: location.arrivedToProviderUnder15Percent,
      arrivedToProviderUnder45Percent: location.arrivedToProviderUnder45Percent,
      providerToDischargedAverage: location.providerToDischargedAverage,
      providerToDischargedMedian: location.providerToDischargedMedian,
      onTimePercent: location.onTimePercent,
      bookAheadPercent: location.bookAheadPercent,
      walkInPercent: location.walkInPercent,
      visitCount: location.visitCount,
    }));
  }, [reportData]);

  // Open the data BEHIND these KPIs in the ad-hoc report. The KPI zambda only returns per-location
  // aggregates, so for real exploration/drill-down we fetch the underlying per-visit ENCOUNTERS for
  // the same date range (the Encounters ad-hoc dataset already exposes the arrival/intake/provider
  // time buckets the KPIs are computed from), then seed those. The ad-hoc page picks up the seed and
  // skips its own fetch.
  const handleOpenAsAdHoc = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) return;
    setSeeding(true);
    setError(null);
    try {
      const { start, end } = getDateRange(dateFilter, customDate);
      const encounterRows = await encountersDataset.fetch({ oystehrZambda, dateRange: { start, end } });
      const schema = encountersDataset.buildSchema(encounterRows);
      const rangeLabel = DATE_FILTER_LABELS[dateFilter] ?? `${start.slice(0, 10)}…${end.slice(0, 10)}`;
      setAdHocSeed({
        rows: encounterRows,
        schema,
        sourceLabel: `Encounters behind Practice KPIs${rangeLabel ? ` · ${rangeLabel}` : ''}`,
      });
      navigate('/reports/ad-hoc');
    } catch (e) {
      console.error('Failed to load encounters for ad-hoc exploration:', e);
      setError('Failed to load the underlying visit data for ad-hoc exploration. Please try again.');
    } finally {
      setSeeding(false);
    }
  }, [oystehrZambda, dateFilter, customDate, getDateRange, navigate]);

  // Custom toolbar with CSV export only
  const CustomToolbar = (): React.ReactElement => {
    return (
      <GridToolbarContainer>
        <GridToolbarExport csvOptions={{ fileName: 'practice-kpis' }} printOptions={{ disableToolbarButton: true }} />
      </GridToolbarContainer>
    );
  };

  return (
    <PageContainer>
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleBack} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <InsightsIcon sx={{ fontSize: 32, mr: 2, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" component="h1" color="primary.dark" fontWeight={600}>
              Practice KPIs
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Location-level performance metrics for in-person visits
            </Typography>
          </Box>
        </Box>

        {/* Date Filter */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
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
                  <MenuItem value="last7days">Last 7 days</MenuItem>
                  <MenuItem value="last30days">Last 30 days</MenuItem>
                  <MenuItem value="custom">Custom date</MenuItem>
                  <MenuItem value="customRange">Custom range</MenuItem>
                </Select>
              </FormControl>

              {dateFilter === 'custom' && (
                <TextField
                  label="Select Date"
                  type="date"
                  value={customDate}
                  onChange={handleCustomDateChange}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  sx={{ minWidth: 180 }}
                />
              )}

              {dateFilter === 'customRange' && (
                <>
                  <TextField
                    label="Start Date"
                    type="date"
                    value={customStartDate}
                    onChange={handleCustomStartDateChange}
                    InputLabelProps={{
                      shrink: true,
                    }}
                    sx={{ minWidth: 180 }}
                  />
                  <TextField
                    label="End Date"
                    type="date"
                    value={customEndDate}
                    onChange={handleCustomEndDateChange}
                    InputLabelProps={{
                      shrink: true,
                    }}
                    sx={{ minWidth: 180 }}
                  />
                </>
              )}

              <Button variant="outlined" onClick={() => void fetchReport(dateFilter)} disabled={loading}>
                Refresh
              </Button>

              <Button
                variant="outlined"
                color="primary"
                startIcon={seeding ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                onClick={() => void handleOpenAsAdHoc()}
                disabled={loading || seeding || !reportData}
              >
                {seeding ? 'Loading visits…' : 'Explore visits as ad-hoc report'}
              </Button>

              <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                Showing: {getDateRangeLabel(dateFilter)}
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Report Content */}
        {!loading && reportData && (
          <>
            {/* Summary Card */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Summary
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {reportData.message}
                </Typography>
                {reportData.unsignedVisitCount > 0 && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    {`${reportData.unsignedVisitCount} unsigned ${
                      reportData.unsignedVisitCount === 1 ? 'visit was' : 'visits were'
                    } excluded from this report.`}
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Location Metrics Table */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Location Metrics
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Average time spent in "Arrived" status by location (includes discharged in-person visits only)
                </Typography>
                <Box sx={{ height: 600, width: '100%' }}>
                  <DataGrid
                    rows={rows}
                    columns={columns}
                    slots={{
                      toolbar: CustomToolbar,
                    }}
                    initialState={{
                      pagination: {
                        paginationModel: { pageSize: 25 },
                      },
                    }}
                    pageSizeOptions={[10, 25, 50, 100]}
                    disableRowSelectionOnClick
                    sx={{
                      '& .MuiDataGrid-cell': {
                        fontSize: '0.875rem',
                      },
                    }}
                  />
                </Box>
              </CardContent>
            </Card>
          </>
        )}

        {/* No Data State */}
        {!loading && !reportData && !error && (
          <Card>
            <CardContent>
              <Typography variant="body1" color="text.secondary" align="center">
                No data available. Please select a date range.
              </Typography>
            </CardContent>
          </Card>
        )}
      </Box>
    </PageContainer>
  );
}
