import { otherColors } from '@ehrTheme/colors';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ClearIcon from '@mui/icons-material/Clear';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Grid,
  IconButton,
  Pagination,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { ReactElement, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitLabOrder } from 'src/api/api';
import { CustomDialog } from 'src/components/dialogs';
import { useApiClients } from 'src/hooks/useAppClients';
import { LabOrderDTO, LabOrderListPageDTO, LabOrdersSearchBy, openPdf, OrderableItemSearchResult } from 'utils';
import { getExternalLabOrderEditUrl } from '../../../css-module/routing/helpers';
import { LabsAutocompleteForPatient } from '../LabsAutocompleteForPatient';
import { LabOrderLoading } from './LabOrderLoading';
import { LabsTableRow } from './LabsTableRow';
import { usePatientLabOrders } from './usePatientLabOrders';

export type LabsTableColumn =
  | 'testType'
  | 'visit'
  | 'orderAdded'
  | 'ordered'
  | 'provider'
  | 'dx'
  | 'resultsReceived'
  | 'accessionNumber'
  | 'requisitionNumber'
  | 'status'
  | 'detail'
  | 'actions';

type LabsTableProps<SearchBy extends LabOrdersSearchBy> = {
  searchBy: SearchBy;
  columns: LabsTableColumn[];
  showFilters?: boolean;
  allowDelete?: boolean;
  allowSubmit?: boolean;
  titleText?: string;
  onCreateOrder?: () => void;
};

export const LabsTable = <SearchBy extends LabOrdersSearchBy>({
  searchBy,
  columns,
  showFilters = false,
  allowDelete = false,
  allowSubmit = false,
  titleText,
  onCreateOrder,
}: LabsTableProps<SearchBy>): ReactElement => {
  const navigateTo = useNavigate();
  const theme = useTheme();
  const { oystehrZambda: oystehr } = useApiClients();

  const {
    labOrders,
    loading,
    totalPages,
    page,
    setSearchParams,
    visitDateFilter,
    showPagination,
    error: fetchError,
    showDeleteLabOrderDialog,
    DeleteOrderDialog,
    patientLabItems,
    fetchLabOrders,
  } = usePatientLabOrders(searchBy);

  const [selectedOrderedItem, setSelectedOrderedItem] = useState<OrderableItemSearchResult | null>(null);
  const [tempDateFilter, setTempDateFilter] = useState(visitDateFilter);
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>();
  const [errorDialogOpen, setErrorDialogOpen] = useState<boolean>(false);
  const [manualError, setManualError] = useState<string | undefined>();
  const [failedOrderNumbers, setFailedOrderNumbers] = useState<string[] | undefined>();

  const { pendingLabs, readyLabs } = labOrders.reduce(
    (acc: { pendingLabs: LabOrderDTO<SearchBy>[]; readyLabs: LabOrderDTO<SearchBy>[] }, lab) => {
      if (lab.orderStatus === 'pending') acc.pendingLabs.push(lab);
      if (lab.orderStatus === 'ready') acc.readyLabs.push(lab);
      return acc;
    },
    { pendingLabs: [], readyLabs: [] }
  );
  const showSubmitButton = allowSubmit && readyLabs.length + pendingLabs.length > 0;
  const showSubmitBanner = allowSubmit && readyLabs.length > 0 && pendingLabs.length === 0;

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

  const submitOrders = async (manualOrder: boolean, labsToSubmit = readyLabs): Promise<void> => {
    if (!oystehr) {
      console.log('error: oystehr client is missing');
      setError('error submitting orders');
      return;
    }

    setSubmitLoading(true);
    console.log('submitting the orders');

    try {
      const { orderPdfUrls, failedOrdersByOrderNumber } = await submitLabOrder(oystehr, {
        serviceRequestIDs: labsToSubmit.map((order) => order.serviceRequestId),
        manualOrder,
      });
      console.log('orderPdfUrls', orderPdfUrls);
      console.log('failedOrdersByOrderNumber', failedOrdersByOrderNumber);
      await Promise.all(orderPdfUrls.map((pdfUrl) => openPdf(pdfUrl)));

      if (failedOrdersByOrderNumber) {
        setFailedOrderNumbers(failedOrdersByOrderNumber);
        setErrorDialogOpen(true);
      } else {
        setErrorDialogOpen(false);
        await fetchLabOrders(searchBy);
      }
    } catch (e) {
      const sdkError = e as Oystehr.OystehrSdkError;
      console.log('error submitting lab', sdkError.code, sdkError.message);
      if (manualOrder) {
        setManualError(sdkError.message);
      } else {
        setError(sdkError.message);
      }
    }
    setSubmitLoading(false);
  };

  const manualSubmit = async (): Promise<void> => {
    if (!failedOrderNumbers) return;
    const labs = labOrders.filter((order) => order.orderNumber && failedOrderNumbers.includes(order.orderNumber));
    await submitOrders(true, labs);
  };

  const manualSubmitDialogDescription = (
    <Box>
      {manualError ? (
        <Typography color="error">{`Error manually submitting: ${manualError}`}</Typography>
      ) : (
        <>
          <Typography color="error">{`Submits failed for the following orders: ${failedOrderNumbers}`}</Typography>
          <Typography sx={{ marginTop: 1 }}>
            {`After clicking confirm you can no longer electronically submit these orders, please confirm this action`}
          </Typography>
        </>
      )}
    </Box>
  );

  if (loading || !labOrders) {
    return <LabOrderLoading />;
  }

  if (fetchError) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="error" variant="body1" gutterBottom>
          {fetchError.message || 'Failed to fetch external lab orders. Please try again later.'}
        </Typography>
        {onCreateOrder && (
          <Button variant="contained" onClick={() => onCreateOrder()} sx={{ mt: 2 }}>
            Add New External Lab
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
      case 'ordered':
        return '15%';
      case 'dx':
        return '13%';
      case 'resultsReceived':
        return '15%';
      case 'accessionNumber':
        return '10%';
      case 'status':
        return '5%';
      case 'detail':
        return '2%';
      case 'actions':
        return '1%';
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
      case 'ordered':
        return 'Ordered';
      case 'dx':
        return 'Dx';
      case 'resultsReceived':
        return 'Results received';
      case 'accessionNumber':
        return 'Accession Number';
      case 'requisitionNumber':
        return 'Requisition Number';
      case 'status':
        return 'Status';
      case 'detail':
        return '';
      case 'actions':
        return '';
      default:
        return '';
    }
  };

  return (
    <>
      {showSubmitBanner && (
        <Box
          sx={{
            width: '100%',
            height: '48px',
            backgroundColor: `${otherColors.lightGreen}`,
            display: 'flex',
            justifyContent: 'left',
            alignItems: 'center',
            borderRadius: '4px',
            py: '6px',
            px: '16px',
          }}
          gap="12px"
        >
          <CheckCircleOutlineIcon sx={{ color: `${theme.palette.success.main}` }}></CheckCircleOutlineIcon>
          <Typography variant="button" sx={{ textTransform: 'none', color: `${theme.palette.success.dark}` }}>
            Tests are ready to be sent. Please review then Submit.
          </Typography>
        </Box>
      )}
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
                  Add New External Lab
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
      {showSubmitButton && (
        <Box display="flex" justifyContent="right" alignItems="center" mt={2} sx={{ width: '100%' }}>
          <LoadingButton
            loading={submitLoading}
            variant="contained"
            sx={{ borderRadius: '50px', textTransform: 'none', py: 1, px: 5, textWrap: 'nowrap' }}
            color="primary"
            size={'medium'}
            onClick={() => submitOrders(false)}
            disabled={pendingLabs.length > 0}
          >
            Submit & Print Order(s)
          </LoadingButton>
        </Box>
      )}
      {error && (
        <Typography sx={{ textAlign: 'right', mt: 1 }} color="error">
          {error}
        </Typography>
      )}
      {failedOrderNumbers && (
        <CustomDialog
          open={errorDialogOpen}
          confirmLoading={submitLoading}
          handleConfirm={manualError ? undefined : manualSubmit}
          confirmText="Confirm manual submit"
          handleClose={async () => {
            await fetchLabOrders(searchBy);
            setErrorDialogOpen(false);
          }}
          title="Manually submitting lab order"
          description={manualSubmitDialogDescription}
          closeButtonText="Cancel"
        />
      )}
    </>
  );
};
