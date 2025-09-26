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
  TextField,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { VisitsOverviewReportZambdaOutput } from 'utils';
import { getVisitsOverviewReport } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import PageContainer from '../../layout/PageContainer';

export default function VisitsOverview(): React.ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<VisitsOverviewReportZambdaOutput | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [customDate, setCustomDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));

  const handleBack = (): void => {
    navigate('/reports');
  };

  const getDateRange = useCallback((filter: string, selectedDate?: string): { start: string; end: string } => {
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
      default:
        return {
          start: now.startOf('day').toISO() ?? '',
          end: now.endOf('day').toISO() ?? '',
        };
    }
  }, []);

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
  }, [dateFilter, fetchReport, customDate]);

  const handleDateFilterChange = (event: any): void => {
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

  const getDateRangeLabel = (filter: string): string => {
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
      default:
        return 'Today';
    }
  };

  // Prepare statistics data
  const statisticsData = useMemo(() => {
    if (!reportData) return [];

    return reportData.appointmentTypes
      .filter((type) => type.count > 0) // Only show types that have appointments
      .sort((a, b) => b.count - a.count); // Sort by count descending
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
            <Select value={dateFilter} label="Date Range" onChange={handleDateFilterChange}>
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="yesterday">Yesterday</MenuItem>
              <MenuItem value="last7days">Last 7 days</MenuItem>
              <MenuItem value="last30days">Last 30 days</MenuItem>
              <MenuItem value="custom">Custom Date</MenuItem>
            </Select>
          </FormControl>

          {dateFilter === 'custom' && (
            <TextField
              type="date"
              size="small"
              value={customDate}
              onChange={handleCustomDateChange}
              sx={{ minWidth: 160 }}
              InputLabelProps={{
                shrink: true,
              }}
            />
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
            {/* Summary Card */}
            <Card sx={{ mb: 4 }}>
              <CardContent>
                <Typography variant="h6" color="primary.main" gutterBottom>
                  Total Appointments
                </Typography>
                <Typography variant="h3" fontWeight="bold" sx={{ mb: 2 }}>
                  {reportData.totalAppointments}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {reportData.message}
                </Typography>
              </CardContent>
            </Card>

            {/* Statistics Section */}
            {statisticsData.length > 0 ? (
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 3 }}>
                    Appointments by Type
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
                    {statisticsData.map((typeData, index) => (
                      <Card key={index} variant="outlined">
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
                </CardContent>
              </Card>
            ) : (
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
