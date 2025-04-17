import {
  Box,
  Button,
  Pagination,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ReactElement, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GetRadiologyOrderListZambdaOrder } from 'utils';
import { getExternalLabOrderEditUrl } from '../../../css-module/routing/helpers';
import { LabOrderLoading } from './LabOrderLoading';
import { RadiologyTableRow } from './RadiologyTableRow';
import { usePatientRadiologyOrders } from './usePatientRadiologyOrders';

export type RadiologyTableColumn = 'studyType' | 'dx' | 'ordered' | 'status' | 'actions';

type RadiologyTableProps = {
  patientId?: string;
  encounterId?: string;
  columns: RadiologyTableColumn[];
  showFilters?: boolean;
  allowDelete?: boolean;
  titleText?: string;
  redirectToOrderCreateIfOrdersEmpty?: boolean;
  onCreateOrder?: () => void;
};

export const RadiologyTable = ({
  patientId,
  encounterId,
  columns,
  allowDelete = false,
  titleText,
  redirectToOrderCreateIfOrdersEmpty = false,
  onCreateOrder,
}: RadiologyTableProps): ReactElement => {
  const navigateTo = useNavigate();

  const { orders, loading, totalPages, page, setPage, showPagination, error, DeleteOrderDialog } =
    usePatientRadiologyOrders({
      patientId,
      encounterId,
    });

  const onRowClick = (order: GetRadiologyOrderListZambdaOrder): void => {
    navigateTo(getExternalLabOrderEditUrl(order.appointmentId, order.serviceRequestId));
  };

  // Redirect to create order page if needed (controlled by the parent component by prop redirectToOrderCreateIfOrdersEmpty)
  useEffect(() => {
    if (redirectToOrderCreateIfOrdersEmpty && !loading && orders.length === 0 && !error && onCreateOrder) {
      const timer = setTimeout(() => {
        return onCreateOrder();
      }, 100);
      return () => clearTimeout(timer);
    }
    return;
  }, [redirectToOrderCreateIfOrdersEmpty, loading, orders.length, error, onCreateOrder]);

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number): void => {
    setPage(value);
  };

  if (loading && orders.length === 0) {
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

  const getColumnWidth = (column: RadiologyTableColumn): string => {
    switch (column) {
      case 'studyType':
        return '25%';
      case 'dx':
        return '25%';
      case 'ordered':
        return '25%';
      case 'status':
        return '15%';
      case 'actions':
        return '10%';
      default:
        return '10%';
    }
  };

  const getColumnHeader = (column: RadiologyTableColumn): string => {
    switch (column) {
      case 'studyType':
        return 'Study type';
      case 'dx':
        return 'Dx';
      case 'ordered':
        return 'Ordered';
      case 'status':
        return 'Status';
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
        {!Array.isArray(orders) || orders.length === 0 ? (
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
                        padding: column === 'studyType' ? '16px 16px' : '8px 16px',
                      }}
                    >
                      {getColumnHeader(column)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((order) => (
                  <RadiologyTableRow
                    key={order.serviceRequestId}
                    order={order}
                    // TODO delete button
                    // onDeleteOrder={() => onDeleteOrder(order)}
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
