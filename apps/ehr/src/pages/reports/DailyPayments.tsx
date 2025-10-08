import { otherColors } from '@ehrTheme/colors';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import { DateTime } from 'luxon';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DailyPaymentsReportZambdaOutput, PaymentItem, PaymentMethodSummary } from 'utils';
import { getDailyPaymentsReport } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import PageContainer from '../../layout/PageContainer';

export default function DailyPayments(): React.ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<DailyPaymentsReportZambdaOutput | null>(null);
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

        const response = await getDailyPaymentsReport(oystehrZambda, {
          dateRange: { start, end },
        });

        setReportData(response);
      } catch (err) {
        console.error('Error fetching daily payments report:', err);
        setError('Failed to load daily payments report. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [getDateRange, oystehrZambda, customDate]
  );

  useEffect(() => {
    void fetchReport(dateFilter);
  }, [dateFilter, fetchReport, customDate]);

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

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
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

  // Extract all individual payments from payment methods
  const allPayments = useMemo((): PaymentItem[] => {
    if (!reportData) return [];

    const payments: PaymentItem[] = [];
    reportData.paymentMethods.forEach((methodSummary) => {
      if (methodSummary.payments) {
        payments.push(...methodSummary.payments);
      }
    });

    return payments;
  }, [reportData]);

  // DataGrid column definitions
  const paymentColumns: GridColDef[] = [
    {
      field: 'createdDate',
      headerName: 'Date',
      width: 160,
      valueFormatter: (params) => {
        if (!params.value) return 'N/A';
        return DateTime.fromISO(params.value as string).toFormat('MM/dd/yyyy HH:mm');
      },
    },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (params) => formatCurrency(params.value as number),
    },
    {
      field: 'paymentMethod',
      headerName: 'Payment Method',
      width: 200,
      renderCell: (params) => (
        <Chip label={params.value || 'Unknown'} size="small" variant="outlined" sx={{ maxWidth: '180px' }} />
      ),
    },
  ];

  return (
    <PageContainer>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleBack} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AttachMoneyIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h4" component="h1" color="primary.dark" fontWeight={600}>
              Daily Payments Report
            </Typography>
          </Box>
        </Box>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Review daily payment reports and transaction summaries for {getDateRangeLabel(dateFilter).toLowerCase()}.
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
            {/* Summary Cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2, mb: 4 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="primary.main" gutterBottom>
                    Total Payments
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {formatCurrency(reportData.totalAmount)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {reportData.totalTransactions} transactions
                  </Typography>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="h6" color="primary.main" gutterBottom>
                    Payment Methods
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {reportData.paymentMethods.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Different methods used
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            {/* Payment Method Summaries */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Payment Methods Summary
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
                {reportData.paymentMethods.map((summary: PaymentMethodSummary, index: number) => (
                  <Card key={index} variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {summary.paymentMethod || 'Unknown Method'}
                        </Typography>
                        <Chip
                          label={`${summary.transactionCount} payments`}
                          size="small"
                          sx={{ backgroundColor: otherColors.lightBlue, color: 'primary.main' }}
                        />
                      </Box>
                      <Typography variant="h5" color="primary.main" fontWeight="bold">
                        {formatCurrency(summary.totalAmount)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Average: {formatCurrency(summary.totalAmount / summary.transactionCount)}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Box>

            {/* Individual Payments Table */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Individual Payments
              </Typography>
              <Box sx={{ height: 600, width: '100%', maxWidth: 800 }}>
                <DataGridPro
                  rows={allPayments}
                  columns={paymentColumns}
                  getRowId={(row) => row.id}
                  pageSizeOptions={[25, 50, 100]}
                  initialState={{
                    pagination: { paginationModel: { pageSize: 25 } },
                    sorting: {
                      sortModel: [{ field: 'createdDate', sort: 'desc' }],
                    },
                  }}
                  disableRowSelectionOnClick
                  sx={{
                    '& .MuiDataGrid-cell': {
                      borderBottom: '1px solid #f0f0f0',
                    },
                    '& .MuiDataGrid-columnHeaders': {
                      backgroundColor: '#f5f5f5',
                      borderBottom: '2px solid #e0e0e0',
                    },
                  }}
                />
              </Box>
            </Box>

            {/* Summary Details */}
            {reportData.paymentMethods.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h6" color="text.secondary">
                  No payments found for the selected period
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
