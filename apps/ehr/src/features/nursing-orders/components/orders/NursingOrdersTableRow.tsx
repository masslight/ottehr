import { Box, IconButton, TableCell, TableRow } from '@mui/material';
import { DateTime } from 'luxon';
import { ReactElement, useState } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { deleteIcon } from 'src/themes/ottehr';
import { NursingOrder } from 'utils/lib/types/data/orders/types';
import { NursingOrdersStatusChip } from '../NursingOrdersStatusChip';
import { NursingOrdersTableColumn } from './NursingOrdersTable';
import { useUpdateNursingOrder } from './useNursingOrders';
interface NursingOrdersTableRowProps {
  columns: NursingOrdersTableColumn[];
  nursingOrderData: NursingOrder;
  refetchOrders: () => void;
  onRowClick?: () => void;
  allowDelete?: boolean;
}

export const NursingOrdersTableRow = ({
  nursingOrderData,
  columns,
  refetchOrders,
  onRowClick,
  allowDelete,
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
            <Box style={{ whiteSpace: 'pre-line' }} data-testid={dataTestIds.nursingOrdersPage.orderNote}>
              {nursingOrderData.note}
            </Box>
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
            {nursingOrderData.status && (
              <NursingOrdersStatusChip
                status={nursingOrderData.status}
                dataTestId={dataTestIds.nursingOrdersPage.status}
              />
            )}
            {nursingOrderData.status === 'pending' && allowDelete && (
              <IconButton
                onClick={async (event) => {
                  event.stopPropagation();
                  setIsDeleteDialogOpen(true);
                }}
                data-testid={dataTestIds.nursingOrdersPage.deleteButton}
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
        data-testid={dataTestIds.nursingOrdersPage.orderRow}
      >
        {columns.map((column) => (
          <TableCell key={column}>{renderCellContent(column)}</TableCell>
        ))}
      </TableRow>
      <AppDialog
        variant="destructive"
        title="Cancel Nursing Order"
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        primary={{
          label: 'Cancel Order',
          loading: isDeleting,
          // As with the old InPersonModal wrapper, the dialog closes once the request has settled,
          // whether or not it succeeded (handleCancelOrder never rejects).
          onClick: async () => {
            await handleCancelOrder();
            setIsDeleteDialogOpen(false);
          },
        }}
        dismiss={{ label: 'Keep Order' }}
      >
        <Box data-testid={dataTestIds.dialog.inPersonModalContent}>
          {`Are you sure you want to cancel this order "${nursingOrderData.note}"?`}
        </Box>
      </AppDialog>
    </>
  );
};
