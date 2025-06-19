import { ReactElement, useState } from 'react';
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
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { LabsTableRow } from './LabsTableRow';
import { usePatientLabOrders } from './usePatientLabOrders';
import { useNavigate } from 'react-router-dom';
import {
  LabOrderListPageDTO,
  LabOrdersSearchBy,
  OrderableItemSearchResult,
  PSC_LOCALE,
} from 'utils/lib/types/data/labs';
import { getExternalLabOrderEditUrl } from '../../../css-module/routing/helpers';
import { LabOrderLoading } from './LabOrderLoading';
import { DateTime } from 'luxon';
import { LabsAutocompleteForPatient } from '../LabsAutocompleteForPatient';

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

type LabsTableProps<SearchBy extends LabOrdersSearchBy> = {
  searchBy: SearchBy;
  columns: LabsTableColumn[];
  showFilters?: boolean;
  allowDelete?: boolean;
  titleText?: string;
  onCreateOrder?: () => void;
};

export const LabsTable = <SearchBy extends LabOrdersSearchBy>({
  searchBy,
  columns,
  showFilters = false,
  allowDelete = false,
  titleText,
  onCreateOrder,
}: LabsTableProps<SearchBy>): ReactElement => {
  const navigateTo = useNavigate();

  const {
    labOrders,
    loading,
    totalPages,
    page,
    setSearchParams,
    visitDateFilter,
    showPagination,
    error,
    showDeleteLabOrderDialog,
    DeleteOrderDialog,
    patientLabItems,
  } = usePatientLabOrders(searchBy);

  const [selectedOrderedItem, setSelectedOrderedItem] = useState<OrderableItemSearchResult | null>(null);

  const [tempDateFilter, setTempDateFilter] = useState(visitDateFilter);

  const submitFilterByDate = (date?: DateTime | null): void => {
    const dateToSet = date || tempDateFilter;
    setSearchParams({ pageNumber: 1, visitDateFilter: dateToSet });
  };

  const handleClearDate = (): void => {
    setTempDateFilter(null);
    setSearchParams({ pageNumber: 1, visitDateFilter: null });
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number): void => {
    setSearchParams({ pageNumber: value });
  };

  const onRowClick = (labOrderData: LabOrderListPageDTO): void => {
    navigateTo(getExternalLabOrderEditUrl(labOrderData.appointmentId, labOrderData.serviceRequestId));
  };

  const handleOrderableItemCodeChange = (value: OrderableItemSearchResult | null): void => {
    setSelectedOrderedItem(value || null);
    setSearchParams({ pageNumber: 1, testTypeFilter: value?.item.itemLoinc || '' });
  };

  if (loading || !labOrders) {
    return <LabOrderLoading />;
  }

  if (error) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="error" variant="body1" gutterBottom>
          {error.message || 'Failed to fetch external lab orders. Please try again later.'}
        </Typography>
        {onCreateOrder && (
          <Button variant="contained" onClick={() => onCreateOrder()} sx={{ mt: 2 }}>
            Create New External Lab Order
          </Button>
        )}
      </Paper>
    );
  }

  const getColumnWidth = (column: LabsTableColumn): string => {
    switch (column) {
      case 'testType':
        return '13%';
      case 'visit':
        return '10%';
      case 'orderAdded':
        return '10%';
      case 'provider':
        return '13%';
      case 'dx':
        return '18%';
      case 'resultsReceived':
        return '10%';
      case 'accessionNumber':
        return '10%';
      case 'status':
        return '5%';
      case 'psc':
        return '6%';
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
        return PSC_LOCALE;
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
      {loading && <LabOrderLoading />}

      {titleText && (
        <Typography
          variant="h3"
          color="primary.dark"
          sx={{ mb: -2, mt: 2, width: '100%', display: 'flex', justifyContent: 'flex-start' }}
        >
          {titleText}
        </Typography>
      )}

      <Box sx={{ width: '100%' }}>
        {showFilters && (
          <LocalizationProvider dateAdapter={AdapterLuxon}>
            <Grid container spacing={2} sx={{ mb: 2, mt: 1 }}>
              <Grid item xs={4}>
                {searchBy.searchBy.field === 'patientId' ? (
                  <LabsAutocompleteForPatient
                    patientLabItems={patientLabItems}
                    selectedLabItem={selectedOrderedItem}
                    setSelectedLabItem={handleOrderableItemCodeChange}
                  />
                ) : null}
              </Grid>
              <Grid item xs={4}>
                <DatePicker
                  label="Visit date"
                  value={tempDateFilter}
                  onChange={setTempDateFilter}
                  onAccept={submitFilterByDate}
                  format="MM/dd/yyyy"
                  slotProps={{
                    textField: (params) => ({
                      ...params,
                      onBlur: () => submitFilterByDate(),
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
              No External Lab Orders to display
            </Typography>
            {onCreateOrder && (
              <Button variant="contained" onClick={() => onCreateOrder()} sx={{ mt: 2 }}>
                Create New External Lab Order
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
                    key={order.serviceRequestId}
                    labOrderData={order}
                    onDeleteOrder={() =>
                      showDeleteLabOrderDialog({
                        serviceRequestId: order.serviceRequestId,
                        testItemName: order.testItem,
                      })
                    }
                    onRowClick={() => onRowClick(order)}
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
