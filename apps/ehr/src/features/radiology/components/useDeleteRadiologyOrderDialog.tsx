import { Box, DialogContentText } from '@mui/material';
import { ReactElement, useCallback, useState } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';

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
    <AppDialog
      variant="destructive"
      open={isDeleteDialogOpen}
      onClose={closeDeleteDialog}
      title="Delete Radiology Order"
      primary={{ label: 'Delete Order', onClick: () => void confirmDeleteOrder(), loading: isDeleting }}
    >
      <DialogContentText>
        Are you sure you want to delete this order <strong>"{studyTypeToDelete}"</strong>?
      </DialogContentText>
      {deleteError && (
        <Box sx={{ mt: 2, color: 'error.main' }}>
          <DialogContentText color="error">{deleteError}</DialogContentText>
        </Box>
      )}
    </AppDialog>
  ) : null;

  return {
    showDeleteRadiologyOrderDialog: showDeleteRadiologyOrderDialog,
    DeleteOrderDialog,
  };
};
