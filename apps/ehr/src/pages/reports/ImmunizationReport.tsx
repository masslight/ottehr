import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import VaccinesIcon from '@mui/icons-material/Vaccines';
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
import { DateTime } from 'luxon';
import React, { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DEFAULT_BATCH_DAYS, ImmunizationReportItem, splitDateRangeIntoBatches } from 'utils';
import { getImmunizationReport } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import PageContainer from '../../layout/PageContainer';

interface ImmunizationRow extends ImmunizationReportItem {
  id: string;
  siteAndRoute: string;
}

type DateRangeFilter =
  | 'today'
  | 'yesterday'
  | 'last-7-days'
  | 'last-7-days-excluding-today'
  | 'last-30-days'
  | 'custom'
  | 'customRange';

const useImmunizationReport = (
  dateRange: DateRangeFilter,
  start: string,
  end: string
): ReturnType<typeof useQuery<ImmunizationRow[], Error>> => {
  const { oystehrZambda } = useApiClients();

  return useQuery({
    queryKey: ['immunization-report', dateRange, start, end],
    queryFn: async (): Promise<ImmunizationRow[]> => {
      if (!oystehrZambda) {
        throw new Error('Oystehr client not available');
      }

      const startDate = DateTime.fromISO(start);
      const endDate = DateTime.fromISO(end);
      const daysDifference = endDate.diff(startDate, 'days').days;

      const fetchAndTransform = (items: ImmunizationReportItem[]): ImmunizationRow[] =>
        items.map((item) => ({
          ...item,
          id: item.medicationAdministrationId,
          siteAndRoute: [item.anatomicalSite, item.route].filter(Boolean).join(' / '),
        }));

      if (daysDifference <= DEFAULT_BATCH_DAYS) {
        const response = await getImmunizationReport(oystehrZambda, {
          dateRange: { start, end },
        });
        return fetchAndTransform(response.immunizations);
      }

      // Split into batches for large date ranges
      const batches = splitDateRangeIntoBatches(start, end, DEFAULT_BATCH_DAYS);
      const batchResults = await Promise.all(
        batches.map(async (batch) => {
          const response = await getImmunizationReport(oystehrZambda, {
            dateRange: batch,
          });
          return response.immunizations;
        })
      );

      const allImmunizations = batchResults.flat();

      // Deduplicate by medicationAdministrationId
      const unique = Array.from(
        new Map(allImmunizations.map((item) => [item.medicationAdministrationId, item])).values()
      );

      return fetchAndTransform(unique);
    },
    enabled: Boolean(oystehrZambda),
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });
};

export default function ImmunizationReport(): React.ReactElement {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRangeFilter>('today');
  const [customDate, setCustomDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [customStartDate, setCustomStartDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));

  const getDateRange = useCallback(
    (filter: DateRangeFilter): { start: string; end: string } => {
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
        case 'custom': {
          const customDateTime = DateTime.fromISO(customDate).setZone('America/New_York');
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
        default: {
          return {
            start: today.toISO() ?? '',
            end: today.endOf('day').toISO() ?? '',
          };
        }
      }
    },
    [customDate, customStartDate, customEndDate]
  );

  const { start, end } = getDateRange(dateRange);
  const { data: immunizations = [], isLoading, error, refetch } = useImmunizationReport(dateRange, start, end);

  const handleBack = (): void => {
    navigate('/reports');
  };

  const handleDateRangeChange = (event: SelectChangeEvent<DateRangeFilter>): void => {
    setDateRange(event.target.value as DateRangeFilter);
  };

  const handleCustomDateChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setCustomDate(event.target.value);
  };

  const handleCustomStartDateChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setCustomStartDate(event.target.value);
  };

  const handleCustomEndDateChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setCustomEndDate(event.target.value);
  };

  const handleRefresh = (): void => {
    void refetch();
  };

  const CustomToolbar = (): React.ReactElement => {
    return (
      <GridToolbarContainer>
        <GridToolbarExport csvOptions={{ fileName: 'immunization-report' }} />
      </GridToolbarContainer>
    );
  };

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'firstName',
        headerName: 'First Name',
        width: 120,
        sortable: true,
        renderCell: (params: GridRenderCellParams) => {
          const patientId = params.row.patientId;
          return (
            <Link
              to={`/patient/${patientId}`}
              style={{
                color: '#1976d2',
                textDecoration: 'underline',
              }}
            >
              {params.value}
            </Link>
          );
        },
      },
      {
        field: 'middleName',
        headerName: 'Middle Name',
        width: 120,
        sortable: true,
      },
      {
        field: 'lastName',
        headerName: 'Last Name',
        width: 140,
        sortable: true,
        renderCell: (params: GridRenderCellParams) => {
          const patientId = params.row.patientId;
          return (
            <Link
              to={`/patient/${patientId}`}
              style={{
                color: '#1976d2',
                textDecoration: 'underline',
              }}
            >
              {params.value}
            </Link>
          );
        },
      },
      {
        field: 'dateOfBirth',
        headerName: 'Date of Birth',
        width: 120,
        sortable: true,
      },
      {
        field: 'sex',
        headerName: 'Sex',
        width: 80,
        sortable: true,
      },
      {
        field: 'raceOrEthnicity',
        headerName: 'Race/Ethnicity',
        width: 150,
        sortable: true,
      },
      {
        field: 'address',
        headerName: 'Address',
        width: 200,
        sortable: true,
      },
      {
        field: 'phoneNumber',
        headerName: 'Phone',
        width: 140,
        sortable: true,
      },
      {
        field: 'email',
        headerName: 'Email',
        width: 200,
        sortable: true,
      },
      {
        field: 'vaccineName',
        headerName: 'Vaccine',
        width: 200,
        sortable: true,
      },
      {
        field: 'dose',
        headerName: 'Dose',
        width: 80,
        sortable: true,
      },
      {
        field: 'units',
        headerName: 'Units',
        width: 80,
        sortable: true,
      },
      {
        field: 'orderedByProvider',
        headerName: 'Ordered By',
        width: 160,
        sortable: true,
      },
      {
        field: 'instructions',
        headerName: 'Instructions',
        width: 180,
        sortable: true,
      },
      {
        field: 'orderStatus',
        headerName: 'Administration Status',
        width: 160,
        sortable: true,
      },
      {
        field: 'dateAdministered',
        headerName: 'Date Administered',
        width: 160,
        sortable: true,
        renderCell: (params: GridRenderCellParams) => {
          const value = params.value as string;
          if (!value) return '';
          return DateTime.fromISO(value).toFormat('MM/dd/yyyy hh:mm a');
        },
      },
      {
        field: 'cptCode',
        headerName: 'CPT Code',
        width: 100,
        sortable: true,
      },
      {
        field: 'cvxCode',
        headerName: 'CVX Code',
        width: 100,
        sortable: true,
      },
      {
        field: 'mvxCode',
        headerName: 'Manufacturer (MVX)',
        width: 130,
        sortable: true,
      },
      {
        field: 'ndcCode',
        headerName: 'NDC Code',
        width: 120,
        sortable: true,
      },
      {
        field: 'lotNumber',
        headerName: 'Lot Number',
        width: 120,
        sortable: true,
      },
      {
        field: 'expirationDate',
        headerName: 'Expiration Date',
        width: 130,
        sortable: true,
      },
      {
        field: 'siteAndRoute',
        headerName: 'Site & Route',
        width: 160,
        sortable: true,
      },
      {
        field: 'administeringProvider',
        headerName: 'Administering Provider',
        width: 180,
        sortable: true,
      },
      {
        field: 'visGiven',
        headerName: 'VIS Given',
        width: 100,
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
            <VaccinesIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h4" component="h1" color="primary.dark" fontWeight={600}>
              Immunizations
            </Typography>
          </Box>
        </Box>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          This report shows vaccine administration data across completed encounters. It includes patient demographics,
          vaccine details (CPT/CVX/MVX/NDC codes), lot numbers, and administering provider information.
        </Typography>

        {/* Date Filter */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Date Range</InputLabel>
            <Select value={dateRange} label="Date Range" onChange={handleDateRangeChange}>
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
              onChange={handleCustomDateChange}
              sx={{ minWidth: 160 }}
              InputLabelProps={{
                shrink: true,
              }}
            />
          )}

          {dateRange === 'customRange' && (
            <>
              <TextField
                type="date"
                size="small"
                label="Start Date"
                value={customStartDate}
                onChange={handleCustomStartDateChange}
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
                sx={{ minWidth: 160 }}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </>
          )}

          <Button variant="outlined" onClick={handleRefresh} disabled={isLoading} startIcon={<RefreshIcon />}>
            Refresh
          </Button>
        </Box>

        <Paper sx={{ height: 600, width: '100%' }}>
          <DataGridPro
            rows={immunizations}
            columns={columns}
            getRowId={(row) => row.medicationAdministrationId}
            loading={isLoading}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 25 },
              },
              sorting: {
                sortModel: [{ field: 'dateAdministered', sort: 'desc' }],
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
              Error loading immunizations: {error instanceof Error ? error.message : 'Unknown error'}
            </Typography>
          </Box>
        )}

        {!isLoading && immunizations.length === 0 && !error && (
          <Box sx={{ mt: 2, p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              No immunizations found for the selected date range
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
              Try selecting a different date range or check if there are any completed encounters with immunizations
            </Typography>
          </Box>
        )}
      </Box>
    </PageContainer>
  );
}
