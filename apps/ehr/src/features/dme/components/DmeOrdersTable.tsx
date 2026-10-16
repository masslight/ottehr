import { otherColors } from '@ehrTheme/colors';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ReactElement, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getDmeOrderDetailsUrl } from 'src/features/visits/in-person/routing/helpers';
import { DmeOrderDTO } from 'utils/lib/types/api/dme.types';
import { formatDate } from 'utils/lib/utils/date';
import { useDmeOrders } from '../dme.queries';
import { DmeOrderActionDialog } from './DmeOrderActionDialog';
import { DmeStatusChip } from './DmeStatusChip';

export type DmeOrdersTableColumn = 'item' | 'dx' | 'ordered' | 'dispensed' | 'status' | 'actions';

export const DME_ORDERS_TABLE_COLUMNS: DmeOrdersTableColumn[] = [
  'item',
  'dx',
  'ordered',
  'dispensed',
  'status',
  'actions',
];

const COLUMN_HEADERS: Record<DmeOrdersTableColumn, string> = {
  item: 'DME',
  dx: 'Dx',
  ordered: 'Ordered',
  dispensed: 'Dispensed',
  status: 'Status',
  actions: '',
};

const COLUMN_WIDTHS: Record<DmeOrdersTableColumn, string> = {
  item: '24%',
  dx: '24%',
  ordered: '18%',
  dispensed: '18%',
  status: '12%',
  actions: '4%',
};

interface DmeOrdersTableProps {
  encounterId: string;
  appointmentId: string;
  columns?: DmeOrdersTableColumn[];
  allowDelete?: boolean;
  onRowClick?: (order: DmeOrderDTO) => void;
  onCreateOrder?: () => void;
}

export const DmeOrdersTable = ({
  encounterId,
  appointmentId,
  columns = DME_ORDERS_TABLE_COLUMNS,
  allowDelete,
  onRowClick,
  onCreateOrder,
}: DmeOrdersTableProps): ReactElement => {
  const navigate = useNavigate();
  const { data: orders, isLoading, error } = useDmeOrders(encounterId);
  const [orderToDelete, setOrderToDelete] = useState<DmeOrderDTO | undefined>();
  const visibleColumns = allowDelete ? columns : columns.filter((column) => column !== 'actions');

  const openOrder = (order: DmeOrderDTO): void => {
    if (onRowClick) onRowClick(order);
    else navigate(getDmeOrderDetailsUrl(appointmentId, order.id));
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }} data-testid={dataTestIds.dmeOrders.loading}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="error">{error.message || 'Failed to fetch DME orders. Please try again later.'}</Typography>
      </Paper>
    );
  }

  if (!orders?.length) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }} data-testid={dataTestIds.dmeOrders.emptyState}>
        <Typography variant="body1" gutterBottom>
          No DME orders to display
        </Typography>
        {onCreateOrder && (
          <Button
            variant="contained"
            onClick={onCreateOrder}
            sx={{ mt: 2, borderRadius: '50px', textTransform: 'none' }}
          >
            Create New DME Order
          </Button>
        )}
      </Box>
    );
  }

  const renderCell = (order: DmeOrderDTO, column: DmeOrdersTableColumn): React.ReactNode => {
    switch (column) {
      case 'item':
        return <Typography variant="body2">{order.itemName}</Typography>;
      case 'dx':
        return order.diagnoses.map((dx) => (
          <Typography key={dx.code} variant="body2">
            {`${dx.code} ${dx.display}`}
          </Typography>
        ));
      case 'ordered':
        return (
          <Box>
            <Typography variant="body2">{formatDate(order.orderedAt, 'MM/dd/yyyy hh:mm a')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {order.orderedBy.name}
            </Typography>
          </Box>
        );
      case 'dispensed':
        return order.dispensed ? (
          <Box>
            <Typography variant="body2">{formatDate(order.dispensed.at, 'MM/dd/yyyy hh:mm a')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {order.dispensed.name}
            </Typography>
          </Box>
        ) : null;
      case 'status':
        return <DmeStatusChip status={order.status} />;
      case 'actions':
        return (
          <IconButton
            aria-label="delete DME order"
            data-testid={dataTestIds.dmeOrders.deleteButton(order.id)}
            onClick={(event) => {
              event.stopPropagation();
              setOrderToDelete(order);
            }}
          >
            <DeleteOutlinedIcon sx={{ color: otherColors.priorityHighText }} />
          </IconButton>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <TableContainer sx={{ border: '1px solid #e0e0e0' }}>
        <Table data-testid={dataTestIds.dmeOrders.table}>
          <TableHead>
            <TableRow>
              {visibleColumns.map((column) => (
                <TableCell key={column} sx={{ fontWeight: 'bold', width: COLUMN_WIDTHS[column], padding: '8px 16px' }}>
                  {COLUMN_HEADERS[column]}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map((order) => (
              <TableRow
                key={order.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => openOrder(order)}
                data-testid={dataTestIds.dmeOrders.orderRow(order.id)}
              >
                {visibleColumns.map((column) => (
                  <TableCell key={column}>{renderCell(order, column)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {orderToDelete && (
        <DmeOrderActionDialog order={orderToDelete} action="delete" open onClose={() => setOrderToDelete(undefined)} />
      )}
    </>
  );
};
