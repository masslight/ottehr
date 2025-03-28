import { ReactElement, useState, useCallback } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { LabOrderDTO } from 'utils';

interface UseDeleteLabOrderDialogProps {
  deleteOrder: (params: { orderId: string; encounterId?: string }) => Promise<boolean>;
  encounterId?: string;
}

interface UseDeleteLabOrderDialogResult {
  onDeleteOrder: (order: LabOrderDTO, encounterIdOverride?: string) => void;
  DeleteOrderDialog: ReactElement | null;
}

export const useDeleteLabOrderDialog = ({
  deleteOrder,
  encounterId,
}: UseDeleteLabOrderDialogProps): UseDeleteLabOrderDialogResult => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [currentOrderToDelete, setCurrentOrderToDelete] = useState<LabOrderDTO | null>(null);
  const [currentOrderEncounterId, setCurrentOrderEncounterId] = useState<string | undefined>(encounterId);

  const onDeleteOrder = useCallback(
    (order: LabOrderDTO, encounterIdOverride?: string): void => {
      setCurrentOrderToDelete(order);
      setCurrentOrderEncounterId(encounterIdOverride || encounterId);
      setIsDeleteDialogOpen(true);
      setDeleteError(null);
    },
    [encounterId]
  );

  const closeDeleteDialog = useCallback((): void => {
    setIsDeleteDialogOpen(false);
    setDeleteError(null);
    setCurrentOrderEncounterId(undefined);
  }, []);

  const confirmDeleteOrder = useCallback(async (): Promise<void> => {
    if (!currentOrderToDelete || !currentOrderToDelete.orderId) {
      setDeleteError('No lab order selected for deletion');
      return;
    }

    const effectiveEncounterId = currentOrderEncounterId || encounterId;
    if (!effectiveEncounterId) {
      setDeleteError('Encounter ID is required to delete lab order');
      return;
    }

    setIsDeleting(true);

    try {
      const success = await deleteOrder({
        orderId: currentOrderToDelete.orderId,
        encounterId: effectiveEncounterId,
      });

      if (success) {
        setIsDeleteDialogOpen(false);
      } else {
        setDeleteError('Failed to delete lab order');
      }
    } catch (err) {
      console.error('Error confirming delete:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during deletion';
      setDeleteError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  }, [currentOrderToDelete, deleteOrder, encounterId, currentOrderEncounterId]);

  const DeleteOrderDialog = isDeleteDialogOpen ? (
    <Dialog open={isDeleteDialogOpen} onClose={closeDeleteDialog} maxWidth="sm" fullWidth>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void confirmDeleteOrder();
        }}
      >
        <DialogTitle>Delete Lab Order</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the lab order for test <strong>{currentOrderToDelete?.typeLab}</strong>?
            <br />
            <br />
            This action cannot be undone.
          </DialogContentText>
          {deleteError && (
            <Box sx={{ mt: 2, color: 'error.main' }}>
              <DialogContentText color="error">{deleteError}</DialogContentText>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDeleteDialog} color="primary" disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="error"
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  ) : null;

  return {
    onDeleteOrder,
    DeleteOrderDialog,
  };
};
