import { LoadingButton } from '@mui/lab';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { ReactElement } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useAdminDeleteEmCodeMutation } from './admin.queries';

interface EMCodeDeleteDialogProps {
  code: string | null;
  onClose: () => void;
}

export default function EMCodeDeleteDialog({ code, onClose }: EMCodeDeleteDialogProps): ReactElement {
  const deleteMutation = useAdminDeleteEmCodeMutation();

  const handleConfirm = (): void => {
    if (code) {
      deleteMutation.mutate({ code }, { onSuccess: onClose });
    }
  };

  return (
    <Dialog open={code !== null} onClose={onClose} data-testid={dataTestIds.emCodesAdminPage.confirmDeleteDialog}>
      <DialogTitle>Delete E&M Code</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to delete code <strong>{code}</strong>? This action cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          disabled={deleteMutation.isPending}
          data-testid={dataTestIds.emCodesAdminPage.cancelDeleteButton}
        >
          Cancel
        </Button>
        <LoadingButton
          loading={deleteMutation.isPending}
          onClick={handleConfirm}
          color="error"
          variant="contained"
          data-testid={dataTestIds.emCodesAdminPage.confirmDeleteButton}
        >
          Delete
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
