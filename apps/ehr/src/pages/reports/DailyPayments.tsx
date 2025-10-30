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
import { DataGridPro, GridColDef, GridToolbarContainer, GridToolbarExport } from '@mui/x-data-grid-pro';
import { Location } from 'fhir/r4b';
import { DateTime } from 'luxon';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DailyPaymentsReportZambdaOutput, PaymentItem, PaymentMethodSummary } from 'utils';
import { getDailyPaymentsReport } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import PageContainer from '../../layout/PageContainer';

const BATCH_DAYS = 5;

export default function DailyPayments(): React.ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda, oystehr } = useApiClients();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<DailyPaymentsReportZambdaOutput | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [customDate, setCustomDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState<boolean>(true);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');

  const handleBack = (): void => {
    navigate('/reports');
  };

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

  /**
   * Splits a date range into batches of maximum BATCH_DAYS days each
   */
  const splitDateRangeIntoBatches = useCallback(
    (start: string, end: string, maxDays: number = BATCH_DAYS): Array<{ start: string; end: string }> => {
      const startDate = DateTime.fromISO(start);
      const endDate = DateTime.fromISO(end);

      const batches: Array<{ start: string; end: string }> = [];
      let currentStart = startDate;

      while (currentStart < endDate) {
        // Calculate the end of the current batch (5 days from start, or the final end date)
        const currentEnd = DateTime.min(currentStart.plus({ days: maxDays }).minus({ milliseconds: 1 }), endDate);

        batches.push({
          start: currentStart.toISO() ?? '',
          end: currentEnd.toISO() ?? '',
        });

        // Move to the next batch
        currentStart = currentEnd.plus({ milliseconds: 1 });
      }

      return batches;
    },
    []
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

        // Calculate the date range in days
        const startDate = DateTime.fromISO(start);
        const endDate = DateTime.fromISO(end);
        const daysDifference = endDate.diff(startDate, 'days').days;

        console.log(`Date range is ${daysDifference.toFixed(2)} days`);

        // If the date range is <= BATCH_DAYS days, make a single request
        if (daysDifference <= BATCH_DAYS) {
          console.log('Making single request for date range');
          const response = await getDailyPaymentsReport(oystehrZambda, {
            dateRange: { start, end },
            ...(selectedLocationId !== 'all' && { locationId: selectedLocationId }),
          });

          setReportData(response);
        } else {
          // Split the date range into BATCH_DAYS-day batches
          const batches = splitDateRangeIntoBatches(start, end, BATCH_DAYS);
          console.log(`Splitting date range into ${batches.length} batches of up to ${BATCH_DAYS} days each`);

          // Fetch data for each batch in parallel
          const batchPromises = batches.map(async (batch, index) => {
            console.log(`Fetching batch ${index + 1}/${batches.length}: ${batch.start} to ${batch.end}`);
            const response = await getDailyPaymentsReport(oystehrZambda, {
              dateRange: batch,
              ...(selectedLocationId !== 'all' && { locationId: selectedLocationId }),
            });
            console.log(`Batch ${index + 1} returned ${response.paymentMethods.length} payment methods`);
            return response;
          });

          // Wait for all batches to complete
          const batchResults = await Promise.all(batchPromises);

          // Combine all payment methods and payments from all batches
          const allPaymentMethods = new Map<string, PaymentMethodSummary>();
          const currenciesSet = new Set<string>();
          let totalAmount = 0;
          let totalTransactions = 0;

          batchResults.forEach((batchResult) => {
            totalAmount += batchResult.totalAmount;
            totalTransactions += batchResult.totalTransactions;

            // Collect currencies
            batchResult.currencies.forEach((currency) => currenciesSet.add(currency));

            // Merge payment methods
            batchResult.paymentMethods.forEach((method) => {
              const existingMethod = allPaymentMethods.get(method.paymentMethod);

              if (existingMethod) {
                // Combine with existing
                existingMethod.totalAmount += method.totalAmount;
                existingMethod.transactionCount += method.transactionCount;
                if (method.payments && existingMethod.payments) {
                  existingMethod.payments.push(...method.payments);
                }
              } else {
                // Add new method
                allPaymentMethods.set(method.paymentMethod, { ...method });
              }
            });
          });

          console.log(`Total combined: ${totalTransactions} transactions, ${totalAmount} amount`);

          // Build combined response
          const combinedResponse: DailyPaymentsReportZambdaOutput = {
            message: `Found ${totalTransactions} payments across ${batches.length} batches`,
            totalAmount,
            totalTransactions,
            currencies: Array.from(currenciesSet),
            paymentMethods: Array.from(allPaymentMethods.values()),
          };

          setReportData(combinedResponse);
        }
      } catch (err) {
        console.error('Error fetching daily payments report:', err);
        setError('Failed to load daily payments report. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [getDateRange, oystehrZambda, customDate, selectedLocationId, splitDateRangeIntoBatches]
  );

  useEffect(() => {
    void fetchReport(dateFilter);
  }, [dateFilter, fetchReport, customDate, selectedLocationId]);

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

  const handleLocationFilterChange = (event: SelectChangeEvent<string>): void => {
    const newLocationId = event.target.value;
    setSelectedLocationId(newLocationId);
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

  // Custom toolbar component with export functionality
  const CustomToolbar = (): React.ReactElement => {
    return (
      <GridToolbarContainer>
        <GridToolbarExport csvOptions={{ fileName: 'daily-payments-report' }} />
      </GridToolbarContainer>
    );
  };

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
                  slots={{
                    toolbar: CustomToolbar,
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
