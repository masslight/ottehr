import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNursingOrderDetailsUrl } from 'src/features/css-module/routing/helpers';
import { NursingOrdersSearchBy } from 'utils';
import { NursingOrdersTableRow } from './NursingOrdersTableRow';
import { useGetNursingOrders } from './useNursingOrders';

export type NursingOrdersTableColumn = 'order' | 'orderAdded' | 'status';

type NursingOrdersTableProps = {
  columns: NursingOrdersTableColumn[];
  searchBy: NursingOrdersSearchBy;
  appointmentId: string;
  allowDelete?: boolean;
  onCreateOrder?: () => void;
};

export const NursingOrdersTable = ({
  columns,
  searchBy,
  appointmentId,
  onCreateOrder,
}: NursingOrdersTableProps): ReactElement => {
  const navigateTo = useNavigate();

  const { nursingOrders, loading, error, fetchNursingOrders: refetch } = useGetNursingOrders({ searchBy });

  const onRowClick = (nursingOrderData: { serviceRequestId: string }): void => {
    navigateTo(getNursingOrderDetailsUrl(appointmentId, nursingOrderData.serviceRequestId));
  };

  if (loading) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1">Loading nursing orders...</Typography>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="error" variant="body1" gutterBottom>
          {error.message || 'Failed to fetch nursing orders. Please try again later.'}
        </Typography>
        {onCreateOrder && (
          <Button variant="contained" onClick={() => onCreateOrder()} sx={{ mt: 2 }}>
            Create New Nursing Order
          </Button>
        )}
      </Paper>
    );
  }

  const getColumnWidth = (column: NursingOrdersTableColumn): string => {
    switch (column) {
      case 'order':
        return '60%';
      case 'orderAdded':
        return '20%';
      case 'status':
        return '20%';
      default:
        return '10%';
    }
  };

  const getColumnHeader = (column: NursingOrdersTableColumn): string => {
    switch (column) {
      case 'order':
        return 'Order';
      case 'orderAdded':
        return 'Ordered';
      case 'status':
        return 'Status';
      default:
        return '';
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {!Array.isArray(nursingOrders) || nursingOrders.length === 0 ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" gutterBottom>
            No nursing orders to display
          </Typography>
          {onCreateOrder && (
            <Button variant="contained" onClick={() => onCreateOrder()} sx={{ mt: 2 }}>
              Create New Nursing Order
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
                      padding: '8px 16px',
                    }}
                  >
                    {getColumnHeader(column)}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {nursingOrders.map((order) => (
                <NursingOrdersTableRow
                  key={order.serviceRequestId}
                  nursingOrderData={order}
                  onRowClick={() => onRowClick(order)}
                  columns={columns}
                  refetchOrders={refetch}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};
