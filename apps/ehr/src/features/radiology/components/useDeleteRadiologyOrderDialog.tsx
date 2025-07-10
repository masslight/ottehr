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
import { ReactElement, useCallback, useState } from 'react';

interface UseDeleteRadiologyOrderDialogProps {
  deleteOrder: ({ serviceRequestId }: { serviceRequestId: string }) => Promise<boolean>;
}

interface UseDeleteRadiologyOrderDialogResult {
  showDeleteRadiologyOrderDialog: ({
    serviceRequestId,
    studyType,
  }: {
    serviceRequestId: string;
    studyType: string;
  }) => void;
  DeleteOrderDialog: ReactElement | null;
}

export const useDeleteRadiologyOrderDialog = ({
  deleteOrder,
}: UseDeleteRadiologyOrderDialogProps): UseDeleteRadiologyOrderDialogResult => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [serviceRequestIdToDelete, setServiceRequestIdToDelete] = useState<string>('');
  const [studyTypeToDelete, setStudyTypeToDelete] = useState<string>('');

  const showDeleteRadiologyOrderDialog = useCallback(
    ({ serviceRequestId, studyType }: { serviceRequestId: string; studyType: string }): void => {
      setServiceRequestIdToDelete(serviceRequestId);
      setStudyTypeToDelete(studyType);
      setIsDeleteDialogOpen(true);
      setDeleteError(null);
    },
    []
  );

  const closeDeleteDialog = useCallback((): void => {
    setIsDeleteDialogOpen(false);
    setDeleteError(null);
  }, []);

  const confirmDeleteOrder = useCallback(async (): Promise<void> => {
    if (!serviceRequestIdToDelete) {
      setDeleteError('No radiology order selected for deletion');
      return;
    }

    setIsDeleting(true);

    try {
      const success = await deleteOrder({
        serviceRequestId: serviceRequestIdToDelete,
      });

      if (success) {
        setIsDeleteDialogOpen(false);
      } else {
        setDeleteError('Failed to delete radiology order');
      }
    } catch (err) {
      console.error('Error confirming delete:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during deletion';
      setDeleteError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  }, [serviceRequestIdToDelete, deleteOrder]);

  const DeleteOrderDialog = isDeleteDialogOpen ? (
    <Dialog open={isDeleteDialogOpen} onClose={closeDeleteDialog} maxWidth="sm" fullWidth>
      <form
        style={{ padding: '10px' }}
        onSubmit={(e) => {
          e.preventDefault();
          void confirmDeleteOrder();
        }}
      >
        <DialogTitle variant="h5" color="primary.dark">
          Delete Radiology Order
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this order <strong>"{studyTypeToDelete}"</strong>?
          </DialogContentText>
          {deleteError && (
            <Box sx={{ mt: 2, color: 'error.main' }}>
              <DialogContentText color="error">{deleteError}</DialogContentText>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, width: '100%', display: 'flex', justifyContent: 'space-between' }}>
          <Button
            variant="outlined"
            onClick={closeDeleteDialog}
            color="primary"
            disabled={isDeleting}
            sx={{ borderRadius: '50px', textTransform: 'none' }}
          >
            Keep
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="error"
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ borderRadius: '50px', textTransform: 'none' }}
          >
            {isDeleting ? 'Deleting Order...' : 'Delete Order'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  ) : null;

  return {
    showDeleteRadiologyOrderDialog: showDeleteRadiologyOrderDialog,
    DeleteOrderDialog,
  };
};
