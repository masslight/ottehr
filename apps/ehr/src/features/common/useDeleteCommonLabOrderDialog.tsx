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

interface UseDeleteCommonLabOrderDialogProps {
  deleteOrder: ({
    serviceRequestId,
    testItemName,
  }: {
    serviceRequestId: string;
    testItemName: string;
  }) => Promise<boolean>;
  locales?: typeof defaultLocalesConstants;
}

const defaultLocalesConstants = {
  noLabOrderSelectedForDeletion: 'No lab order selected for deletion',
  failedToDeleteLabOrder: 'Failed to delete lab order',
  errorOccurredDuringDeletion: 'An error occurred during deletion',
  errorConfirmingDelete: 'Error confirming delete:',
  deleteOrderDialogTitle: 'Delete Lab Order',
  deleteOrderDialogContent: (testItemName: string) => (
    <>
      Are you sure you want to delete this order <strong>{testItemName}</strong>?
      <br />
      <br />
      Deleting this order will also remove any additional associated diagnoses.
    </>
  ),
  deleteOrderDialogKeepButton: 'Keep',
  deleteOrderDialogDeleteButton: 'Delete Order',
  deleteOrderDialogDeletingButton: 'Deleting Order...',
};

interface UseDeleteCommonLabOrderDialogResult {
  showDeleteLabOrderDialog: ({
    serviceRequestId,
    testItemName,
  }: {
    serviceRequestId: string;
    testItemName: string;
  }) => void;
  DeleteOrderDialog: ReactElement | null;
}

export const useDeleteCommonLabOrderDialog = ({
  deleteOrder,
  locales = defaultLocalesConstants,
}: UseDeleteCommonLabOrderDialogProps): UseDeleteCommonLabOrderDialogResult => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [serviceRequestIdToDelete, setServiceRequestIdToDelete] = useState<string>('');
  const [testItemNameToDelete, setTestItemNameToDelete] = useState<string>('');

  const showDeleteLabOrderDialog = useCallback(
    ({ serviceRequestId, testItemName }: { serviceRequestId: string; testItemName: string }): void => {
      setServiceRequestIdToDelete(serviceRequestId);
      setTestItemNameToDelete(testItemName);
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
      setDeleteError(locales.noLabOrderSelectedForDeletion);
      return;
    }

    setIsDeleting(true);

    try {
      const success = await deleteOrder({
        serviceRequestId: serviceRequestIdToDelete,
        testItemName: testItemNameToDelete,
      });

      if (success) {
        setIsDeleteDialogOpen(false);
      } else {
        setDeleteError(locales.failedToDeleteLabOrder);
      }
    } catch (err) {
      console.error(locales.errorConfirmingDelete, err);
      const errorMessage = err instanceof Error ? err.message : locales.errorOccurredDuringDeletion;
      setDeleteError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  }, [serviceRequestIdToDelete, testItemNameToDelete, deleteOrder, locales]);

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
          {locales.deleteOrderDialogTitle}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>{locales.deleteOrderDialogContent(testItemNameToDelete)}</DialogContentText>
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
            {locales.deleteOrderDialogKeepButton}
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="error"
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ borderRadius: '50px', textTransform: 'none' }}
          >
            {isDeleting ? locales.deleteOrderDialogDeletingButton : locales.deleteOrderDialogDeleteButton}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  ) : null;

  return {
    showDeleteLabOrderDialog,
    DeleteOrderDialog,
  };
};
