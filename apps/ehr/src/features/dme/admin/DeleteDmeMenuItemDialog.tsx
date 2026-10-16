import { LoadingButton } from '@mui/lab';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect } from 'react';
import { DmeMenuItem } from 'utils/lib/types/api/dme.types';
import { useDeleteDmeMenuItem } from '../dme.queries';
import { dmeMenuTestIds } from './dmeMenuTestIds';

interface DeleteDmeMenuItemDialogProps {
  item: DmeMenuItem | null;
  onClose: () => void;
}

export function DeleteDmeMenuItemDialog({ item, onClose }: DeleteDmeMenuItemDialogProps): ReactElement {
  const deleteMutation = useDeleteDmeMenuItem();
  const { reset } = deleteMutation;

  useEffect(() => {
    if (item) reset();
  }, [item, reset]);

  const handleClose = (): void => {
    if (!deleteMutation.isPending) onClose();
  };

  const handleConfirm = (): void => {
    if (!item) return;
    deleteMutation.mutate(
      { menuItemId: item.id },
      {
        onSuccess: () => {
          enqueueSnackbar('DME item deleted', { variant: 'success' });
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open={item !== null} onClose={handleClose} data-testid={dmeMenuTestIds.confirmDeleteDialog}>
      <DialogTitle>Delete DME item</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to remove <strong>{item?.name}</strong> from the DME menu? Existing orders are not
          affected.
        </DialogContentText>
        {deleteMutation.error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {deleteMutation.error.message || 'Failed to delete the DME item'}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={handleClose}
          disabled={deleteMutation.isPending}
          data-testid={dmeMenuTestIds.cancelDeleteButton}
        >
          Cancel
        </Button>
        <LoadingButton
          loading={deleteMutation.isPending}
          onClick={handleConfirm}
          color="error"
          variant="contained"
          data-testid={dmeMenuTestIds.confirmDeleteButton}
        >
          Delete
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
