import { Box, IconButton, TableCell, TableRow } from '@mui/material';
import { DateTime } from 'luxon';
import { ReactElement } from 'react';
import { NursingOrder } from 'utils';
import { deleteIcon } from '../../../../themes/ottehr';
import { NursingOrdersStatusChip } from '../NursingOrdersStatusChip';
import { NursingOrdersTableColumn } from './NursingOrdersTable';
import { useUpdateNursingOrder } from './useNursingOrders';
interface NursingOrdersTableRowProps {
  columns: NursingOrdersTableColumn[];
  nursingOrderData: NursingOrder;
  refetchOrders: () => void;
  onRowClick?: () => void;
}

export const NursingOrdersTableRow = ({
  nursingOrderData,
  columns,
  refetchOrders,
  onRowClick,
}: NursingOrdersTableRowProps): ReactElement => {
  const { updateNursingOrder } = useUpdateNursingOrder({
    serviceRequestId: nursingOrderData.serviceRequestId,
    action: 'CANCEL ORDER',
  });

  const handleCancel = async (): Promise<void> => {
    try {
      await updateNursingOrder();
    } catch (error) {
      console.error('Error cancelling nursing order:', error);
    }
  };

  const formatDate = (datetime: string): string => {
    if (!datetime || !DateTime.fromISO(datetime).isValid) return '';
    return DateTime.fromISO(datetime).setZone(nursingOrderData.encounterTimezone).toFormat('MM/dd/yyyy hh:mm a');
  };

  const renderCellContent = (column: NursingOrdersTableColumn): React.ReactNode => {
    switch (column) {
      case 'order':
        return (
          <Box>
            <Box>{nursingOrderData.note}</Box>
          </Box>
        );
      case 'orderAdded':
        return (
          <Box>
            <Box>{formatDate(nursingOrderData.orderAddedDate)}</Box>
            <Box sx={{ opacity: '60%' }}>{nursingOrderData.orderingPhysician}</Box>
          </Box>
        );
      case 'status':
        return (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {nursingOrderData.status && <NursingOrdersStatusChip status={nursingOrderData.status} />}
            {nursingOrderData.status === 'pending' && (
              <IconButton
                onClick={async (event) => {
                  event.stopPropagation();
                  await handleCancel();
                  refetchOrders();
                }}
              >
                <img alt="delete icon" src={deleteIcon} width={18} />
              </IconButton>
            )}
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <TableRow
      sx={{
        '&:hover': { backgroundColor: '#f5f5f5' },
        cursor: 'pointer',
      }}
      onClick={onRowClick}
    >
      {columns.map((column) => (
        <TableCell key={column}>{renderCellContent(column)}</TableCell>
      ))}
    </TableRow>
  );
};
