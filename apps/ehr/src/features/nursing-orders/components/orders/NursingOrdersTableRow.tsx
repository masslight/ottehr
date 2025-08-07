import { Box, IconButton, TableCell, TableRow } from '@mui/material';
import { DateTime } from 'luxon';
import { ReactElement, useState } from 'react';
import { CSSModal } from 'src/features/css-module/components/CSSModal';
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { updateNursingOrder } = useUpdateNursingOrder({
    serviceRequestId: nursingOrderData.serviceRequestId,
    action: 'CANCEL ORDER',
  });

  const handleCancelOrder = async (): Promise<void> => {
    setIsDeleting(true);
    try {
      await updateNursingOrder();
      refetchOrders();
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error cancelling nursing order:', error);
    }
    setIsDeleting(false);
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
            <Box style={{ whiteSpace: 'pre-line' }}>{nursingOrderData.note}</Box>
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
                  setIsDeleteDialogOpen(true);
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
    <>
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
      <CSSModal
        title="Cancel Nursing Order"
        description={`Are you sure you want to cancel this order "${nursingOrderData.note}"?`}
        open={isDeleteDialogOpen}
        confirmText="Cancel Order"
        handleConfirm={handleCancelOrder}
        closeButtonText="Keep Order"
        handleClose={() => setIsDeleteDialogOpen(false)}
        disabled={isDeleting}
      />
    </>
  );
};
