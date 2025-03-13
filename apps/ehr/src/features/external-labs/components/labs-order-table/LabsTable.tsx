import { ReactElement, useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Box,
  Pagination,
  TextField,
  InputAdornment,
  Grid,
  Paper,
  CircularProgress,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DateTime } from 'luxon';
import { DEFAULT_LABS_ITEMS_PER_PAGE, LabOrderDTO, GetLabOrdersParameters } from 'utils';
import SearchIcon from '@mui/icons-material/Search';
import { LabsTableRow } from './LabsTableRow';

export type LabsTableColumn =
  | 'testType'
  | 'visit'
  | 'orderAdded'
  | 'provider'
  | 'dx'
  | 'resultsReceived'
  | 'accessionNumber'
  | 'status'
  | 'psc'
  | 'actions';

interface LabsTableProps {
  labOrders?: LabOrderDTO[];
  fetchLabOrders: (params?: any) => Promise<any>;
  patientId?: string;
  encounterId?: string;
  columns: LabsTableColumn[];
  showFilters?: boolean;
  allowDelete?: boolean;
  initialLoading?: boolean;
  titleText?: string;
}

export const LabsTable = ({
  labOrders: initialLabOrders,
  fetchLabOrders,
  patientId,
  encounterId,
  columns,
  showFilters = false,
  allowDelete = false,
  initialLoading = false,
  titleText: titleText,
}: LabsTableProps): ReactElement => {
  const [loading, setLoading] = useState(initialLoading);
  const [labOrders, setLabOrders] = useState<LabOrderDTO[]>(initialLabOrders || []);
  const [testTypeFilter, setTestTypeFilter] = useState('');
  const [visitDateFilter, setVisitDateFilter] = useState<DateTime | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showPagination, setShowPagination] = useState(false);
  useEffect(() => {
    if (initialLabOrders) {
      setLabOrders(initialLabOrders);
    }
  }, [initialLabOrders]);

  const loadLabOrders = async (): Promise<void> => {
    if (!showFilters && !showPagination && initialLabOrders) {
      return;
    }

    setLoading(true);
    try {
      const params: Partial<GetLabOrdersParameters> = {
        pageIndex: page - 1,
        itemsPerPage: DEFAULT_LABS_ITEMS_PER_PAGE,
      };

      if (patientId) {
        params.patientId = patientId;
      }

      if (encounterId) {
        params.encounterId = encounterId;
      }

      if (showFilters) {
        if (testTypeFilter) {
          params.testType = testTypeFilter;
        }

        if (visitDateFilter) {
          try {
            if (visitDateFilter.isValid) {
              params.visitDate = visitDateFilter.toISODate() || undefined;
            }
          } catch (dateError) {
            console.error('Error formatting date:', dateError);
          }
        }
      }

      const response = await fetchLabOrders(params);

      if (response?.data && response?.pagination) {
        setLabOrders(response.data);
        if (response.pagination) {
          setTotalPages(response.pagination.totalPages);
          setShowPagination(response.pagination.totalPages > 1);
        }
      } else {
        setLabOrders([]);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Error fetching lab orders:', error);
      setLabOrders([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialLabOrders || showFilters || showPagination) {
      void loadLabOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, encounterId, page]);

  const handleTestTypeChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setTestTypeFilter(event.target.value);
  };

  const handleVisitDateChange = (date: DateTime | null): void => {
    if (date === null || date.isValid) {
      setVisitDateFilter(date);
    } else {
      console.error('Invalid date received:', date);
      setVisitDateFilter(null);
    }
  };

  const handleSearch = async (): Promise<void> => {
    setPage(1); // Reset to first page when applying filters
    void loadLabOrders();
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number): void => {
    setPage(value);
  };

  const getColumnWidth = (column: LabsTableColumn): string => {
    switch (column) {
      case 'testType':
        return '15%';
      case 'visit':
        return '10%';
      case 'orderAdded':
        return '10%';
      case 'provider':
        return '15%';
      case 'dx':
        return '20%';
      case 'resultsReceived':
        return '10%';
      case 'accessionNumber':
        return '10%';
      case 'status':
        return '5%';
      case 'psc':
        return '5%';
      case 'actions':
        return '5%';
      default:
        return '10%';
    }
  };

  const getColumnHeader = (column: LabsTableColumn): string => {
    switch (column) {
      case 'testType':
        return 'Test type';
      case 'visit':
        return 'Visit';
      case 'orderAdded':
        return 'Order added';
      case 'provider':
        return 'Provider';
      case 'dx':
        return 'Dx';
      case 'resultsReceived':
        return 'Results received';
      case 'accessionNumber':
        return 'Accession #';
      case 'status':
        return 'Status';
      case 'psc':
        return 'PSC';
      case 'actions':
        return '';
      default:
        return '';
    }
  };

  return (
    <Paper
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        mt: 2,
        p: 3,
        position: 'relative',
      }}
    >
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            zIndex: 10,
          }}
        >
          <CircularProgress sx={{ color: 'primary.main' }} size={40} thickness={4} />
        </Box>
      )}

      {titleText && (
        <Typography
          variant="h3"
          color="primary.dark"
          sx={{ mb: -2, mt: 2, width: '100%', display: 'flex', justifyContent: 'flex-start' }}
        >
          Labs
        </Typography>
      )}

      <Box sx={{ width: '100%' }}>
        {showFilters && (
          <LocalizationProvider dateAdapter={AdapterLuxon}>
            <Grid container spacing={2} sx={{ mb: 2, mt: 1 }}>
              <Grid item xs={4}>
                <TextField
                  fullWidth
                  label="Test type"
                  variant="outlined"
                  size="small"
                  value={testTypeFilter}
                  onChange={handleTestTypeChange}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <SearchIcon cursor="pointer" onClick={handleSearch} />
                      </InputAdornment>
                    ),
                  }}
                  placeholder="CBC"
                />
              </Grid>
              <Grid item xs={4}>
                <DatePicker
                  label="Visit date"
                  value={visitDateFilter}
                  onChange={handleVisitDateChange}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: 'small',
                      onBlur: handleSearch,
                    },
                  }}
                />
              </Grid>
            </Grid>
          </LocalizationProvider>
        )}

        {!Array.isArray(labOrders) || labOrders.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1">No lab orders to display</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell
                      key={column}
                      align="left"
                      sx={{
                        fontWeight: 'bold',
                        width: getColumnWidth(column),
                        padding: column === 'testType' ? '16px 16px' : '8px 16px',
                      }}
                    >
                      {getColumnHeader(column)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {labOrders.map((order) => (
                  <LabsTableRow
                    key={order.id}
                    labOrderData={order}
                    refreshLabOrders={loadLabOrders}
                    columns={columns}
                    allowDelete={allowDelete}
                    encounterId={encounterId}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {showPagination && totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 2, width: '100%' }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={handlePageChange}
              sx={{
                '& .MuiPaginationItem-root.Mui-selected': {
                  backgroundColor: 'grey.300',
                  '&:hover': {
                    backgroundColor: 'grey.400',
                  },
                },
              }}
            />
          </Box>
        )}
      </Box>
    </Paper>
  );
};
