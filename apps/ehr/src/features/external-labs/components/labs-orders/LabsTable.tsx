import { ReactElement, useEffect } from 'react';
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
  Button,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import SearchIcon from '@mui/icons-material/Search';
import { LabsTableRow } from './LabsTableRow';
import { usePatientLabOrders } from './usePatientLabOrders';

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
  patientId?: string;
  encounterId?: string;
  columns: LabsTableColumn[];
  showFilters?: boolean;
  allowDelete?: boolean;
  titleText?: string;
  redirectToOrderCreateIfOrdersEmpty?: boolean;
  onCreateOrder?: () => void;
}

export const LabsTable = ({
  patientId,
  encounterId,
  columns,
  showFilters = false,
  allowDelete = false,
  titleText,
  redirectToOrderCreateIfOrdersEmpty = false,
  onCreateOrder,
}: LabsTableProps): ReactElement => {
  const {
    labOrders,
    loading,
    totalPages,
    page,
    setPage,
    testTypeFilter,
    setTestTypeFilter,
    visitDateFilter,
    setVisitDateFilter,
    showPagination,
    error,
    onDeleteOrder,
    DeleteOrderDialog,
  } = usePatientLabOrders({
    patientId,
    encounterId,
  });

  // Redirect to create order page if needed (controlled by the parent component by prop redirectToOrderCreateIfOrdersEmpty)
  useEffect(() => {
    if (redirectToOrderCreateIfOrdersEmpty && !loading && labOrders.length === 0 && !error && onCreateOrder) {
      const timer = setTimeout(() => {
        return onCreateOrder();
      }, 100);
      return () => clearTimeout(timer);
    }
    return;
  }, [redirectToOrderCreateIfOrdersEmpty, loading, labOrders.length, error, onCreateOrder]);

  const handleTestTypeChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setTestTypeFilter(event.target.value);
  };

  const handleVisitDateChange = (date: any): void => {
    setVisitDateFilter(date);
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number): void => {
    setPage(value);
  };

  if (loading && labOrders.length === 0) {
    return (
      <Paper sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <CircularProgress size={40} thickness={4} />
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
          <Button variant="contained" onClick={onCreateOrder} sx={{ mt: 2 }}>
            Create New Lab Order
          </Button>
        )}
      </Paper>
    );
  }

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
                        <SearchIcon cursor="pointer" />
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
                    },
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
              <Button variant="contained" onClick={onCreateOrder} sx={{ mt: 2 }}>
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
                  <LabsTableRow
                    key={order.id}
                    labOrderData={order}
                    onDeleteOrder={() => onDeleteOrder(order)}
                    columns={columns}
                    allowDelete={allowDelete}
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

      {DeleteOrderDialog}
    </Paper>
  );
};
