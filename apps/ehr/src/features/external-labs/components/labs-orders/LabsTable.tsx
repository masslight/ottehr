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
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { LabsTableRow } from './LabsTableRow';
import { usePatientLabOrders } from './usePatientLabOrders';
import { useNavigate } from 'react-router-dom';
import { LabOrderDTO, OrderableItemSearchResult } from 'utils/lib/types/data/labs';
import { getExternalLabOrderEditUrl } from '../../../css-module/routing/helpers';
import { LabsAutocomplete } from '../LabsAutocomplete';
import { Oystehr } from '@oystehr/sdk/dist/cjs/resources/classes';
import { getCreateLabOrderResources } from '../../../../api/api';
import { useAppointmentStore } from '../../../../telemed/state/appointment/appointment.store';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useApiClients } from '../../../../hooks/useAppClients';
import { LabOrderLoading } from './LabOrderLoading';

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

type LabsTableProps = {
  patientId?: string;
  encounterId?: string;
  columns: LabsTableColumn[];
  showFilters?: boolean;
  allowDelete?: boolean;
  titleText?: string;
  redirectToOrderCreateIfOrdersEmpty?: boolean;
  onCreateOrder?: () => void;
};

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
  const navigateTo = useNavigate();

  const {
    labOrders,
    loading,
    totalPages,
    page,
    setPage,
    setOrderableItemCodeFilter,
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

  const [labs, setLabs] = useState<OrderableItemSearchResult[]>([]);

  const [selectedOrderedItem, setSelectedOrderedItem] = useState<OrderableItemSearchResult | null>(null);

  const [tempDateFilter, setTempDateFilter] = useState(visitDateFilter);

  const submitFilterByDate = (): void => {
    setVisitDateFilter(tempDateFilter);
  };

  const handleClearDate = (): void => {
    setTempDateFilter(null);
    setVisitDateFilter(null);
  };

  const onRowClick = (labOrderData: LabOrderDTO): void => {
    navigateTo(getExternalLabOrderEditUrl(labOrderData.appointmentId, labOrderData.serviceRequestId));
  };

  const { encounter } = getSelectors(useAppointmentStore, ['encounter']);

  const { oystehrZambda } = useApiClients();

  useEffect(() => {
    async function getResources(oystehrZambda: Oystehr): Promise<void> {
      try {
        const { labs } = await getCreateLabOrderResources(oystehrZambda, { encounter });
        setLabs(labs);
      } catch (e) {
        console.error('error loading resources', e);
      }
    }

    if (encounter && oystehrZambda) {
      void getResources(oystehrZambda);
    }
  }, [encounter, oystehrZambda]);

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

  const handleOrderableItemCodeChange = (value: OrderableItemSearchResult | null): void => {
    setOrderableItemCodeFilter(value?.item.itemLoinc || '');
    setSelectedOrderedItem(value || null);
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number): void => {
    setPage(value);
  };

  if (loading && labOrders.length === 0) {
    return <LabOrderLoading />;
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
      {loading && <LabOrderLoading />}

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
              <Grid item xs={4} sx={{ mt: -1 }}>
                <LabsAutocomplete
                  selectedLab={selectedOrderedItem}
                  setSelectedLab={handleOrderableItemCodeChange}
                  labs={labs}
                ></LabsAutocomplete>
              </Grid>
              <Grid item xs={4}>
                <DatePicker
                  label="Visit date"
                  value={tempDateFilter}
                  onChange={setTempDateFilter}
                  onAccept={setVisitDateFilter}
                  format="dd.MM.yyyy"
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
                    key={order.serviceRequestId}
                    labOrderData={order}
                    onDeleteOrder={() => onDeleteOrder(order)}
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
