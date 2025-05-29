import { ReactElement, useEffect, useState } from 'react';
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
  Grid,
  Paper,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Autocomplete,
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { InHouseLabsTableRow } from './InHouseLabsTableRow';
import { useInHouseLabOrders } from './useInHouseLabOrders';
import { useNavigate } from 'react-router-dom';
import { LabOrdersSearchBy } from 'utils/lib/types/data/labs';
import { DateTime } from 'luxon';
import { getInHouseLabOrderDetailsUrl } from 'src/features/css-module/routing/helpers';
import { InHouseOrderListPageDTO, TestItem } from 'utils';
import { getCreateInHouseLabOrderResources } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';

export type InHouseLabsTableColumn =
  | 'testType'
  | 'visit'
  | 'orderAdded'
  | 'provider'
  | 'dx'
  | 'resultsReceived'
  | 'status'
  | 'actions';

type InHouseLabsTableProps<SearchBy extends LabOrdersSearchBy> = {
  searchBy: SearchBy;
  columns: InHouseLabsTableColumn[];
  showFilters?: boolean;
  allowDelete?: boolean;
  titleText?: string;
  redirectToOrderCreateIfOrdersEmpty?: boolean;
  onCreateOrder?: (params?: { isAutoRedirected: boolean }) => void;
};

export const InHouseLabsTable = <SearchBy extends LabOrdersSearchBy>({
  searchBy,
  columns,
  showFilters = false,
  allowDelete = false,
  titleText,
  redirectToOrderCreateIfOrdersEmpty = false,
  onCreateOrder,
}: InHouseLabsTableProps<SearchBy>): ReactElement => {
  const navigateTo = useNavigate();

  const {
    labOrders,
    loading,
    totalPages,
    page,
    setPage,
    setTestTypeFilter,
    visitDateFilter,
    setVisitDateFilter,
    showPagination,
    error,
    showDeleteLabOrderDialog,
    DeleteOrderDialog,
  } = useInHouseLabOrders(searchBy);

  const [testTypeQuery, setTestTypeQuery] = useState<string>('');
  const [tempDateFilter, setTempDateFilter] = useState<DateTime | null>(visitDateFilter);

  const [availableTests, setAvailableTests] = useState<TestItem[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);

  const { oystehrZambda } = useApiClients();

  // set data for filters
  useEffect(() => {
    if (!oystehrZambda || !showFilters) {
      return;
    }

    const fetchTests = async (): Promise<void> => {
      try {
        setLoadingTests(true);
        const response = await getCreateInHouseLabOrderResources(oystehrZambda, {});
        const testItems = response.labs || [];
        setAvailableTests(testItems.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        console.error('Error fetching tests:', error);
      } finally {
        setLoadingTests(false);
      }
    };

    void fetchTests();
  }, [oystehrZambda, showFilters]);

  const submitFilterByDate = (): void => {
    setVisitDateFilter(tempDateFilter);
  };

  const handleClearDate = (): void => {
    setTempDateFilter(null);
    setVisitDateFilter(null);
  };

  const onRowClick = (labOrderData: InHouseOrderListPageDTO): void => {
    navigateTo(getInHouseLabOrderDetailsUrl(labOrderData.appointmentId, labOrderData.serviceRequestId));
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number): void => {
    setPage(value);
  };

  // Redirect to create order page if needed
  useEffect(() => {
    if (redirectToOrderCreateIfOrdersEmpty && !loading && labOrders.length === 0 && !error && onCreateOrder) {
      const timer = setTimeout(() => {
        return onCreateOrder({ isAutoRedirected: true });
      }, 100);
      return () => clearTimeout(timer);
    }
    return;
  }, [redirectToOrderCreateIfOrdersEmpty, loading, labOrders.length, error, onCreateOrder]);

  if (loading) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1">Loading lab orders...</Typography>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="error" variant="body1" gutterBottom>
          {error.message || 'Failed to fetch lab orders. Please try again later.'}
        </Typography>
        {onCreateOrder && (
          <Button variant="contained" onClick={() => onCreateOrder()} sx={{ mt: 2 }}>
            Create New Lab Order
          </Button>
        )}
      </Paper>
    );
  }

  const getColumnWidth = (column: InHouseLabsTableColumn): string => {
    switch (column) {
      case 'testType':
        return '15%';
      case 'visit':
        return '12%';
      case 'orderAdded':
        return '12%';
      case 'provider':
        return '15%';
      case 'dx':
        return '26%';
      case 'resultsReceived':
        return '12%';
      case 'status':
        return '8%';
      case 'actions':
        return '5%';
      default:
        return '10%';
    }
  };

  const getColumnHeader = (column: InHouseLabsTableColumn): string => {
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
      case 'status':
        return 'Status';
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
                <Autocomplete
                  size="small"
                  fullWidth
                  loading={loadingTests}
                  options={availableTests}
                  getOptionLabel={(option) => option.name}
                  value={availableTests.find((test) => test.name === testTypeQuery) || null}
                  onChange={(_, newValue) => {
                    setTestTypeQuery(newValue?.name || '');
                    setTestTypeFilter(newValue?.name || '');
                  }}
                  inputValue={testTypeQuery}
                  onInputChange={(_, newInputValue) => {
                    setTestTypeQuery(newInputValue);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Test type"
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <>
                            <InputAdornment position="start">
                              <SearchIcon />
                            </InputAdornment>
                            {params.InputProps.startAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={4}>
                <DatePicker
                  label="Visit date"
                  value={tempDateFilter}
                  onChange={setTempDateFilter}
                  onAccept={setVisitDateFilter}
                  format="MM/dd/yyyy"
                  slotProps={{
                    textField: (params) => ({
                      ...params,
                      onBlur: submitFilterByDate,
                      fullWidth: true,
                      size: 'small',
                      InputProps: {
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {tempDateFilter && (
                              <IconButton size="small" onClick={handleClearDate} edge="end">
                                <ClearIcon fontSize="small" />
                              </IconButton>
                            )}
                            {params.InputProps?.endAdornment}
                          </>
                        ),
                      },
                    }),
                  }}
                />
              </Grid>
            </Grid>
          </LocalizationProvider>
        )}

        {!Array.isArray(labOrders) || labOrders.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" gutterBottom>
              No lab orders to display
            </Typography>
            {onCreateOrder && (
              <Button variant="contained" onClick={() => onCreateOrder()} sx={{ mt: 2 }}>
                Create New Lab Order
              </Button>
            )}
          </Box>
        ) : (
          <TableContainer sx={{ border: '1px solid #e0e0e0' }}>
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
                  <InHouseLabsTableRow
                    key={order.serviceRequestId}
                    labOrderData={order}
                    onRowClick={() => onRowClick(order)}
                    columns={columns}
                    allowDelete={allowDelete}
                    onDeleteOrder={() =>
                      showDeleteLabOrderDialog({
                        serviceRequestId: order.serviceRequestId,
                        testItemName: order.testItemName,
                      })
                    }
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {showPagination && totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, width: '100%' }}>
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
      {DeleteOrderDialog}
    </Paper>
  );
};
