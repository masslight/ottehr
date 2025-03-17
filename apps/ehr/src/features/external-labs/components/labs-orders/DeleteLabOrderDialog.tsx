import { ReactElement } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
  Box,
  CircularProgress,
} from '@mui/material';
import { LabOrderDTO } from 'utils';

interface DeleteLabOrderDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
  error: string | null;
  labOrder: LabOrderDTO | null;
}

export const DeleteLabOrderDialog = ({
  open,
  onClose,
  onConfirm,
  isDeleting,
  error,
  labOrder,
}: DeleteLabOrderDialogProps): ReactElement => {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    await onConfirm();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Delete Lab Order</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the lab order for test <strong>{labOrder?.type || 'Unknown'}</strong>?
            <br />
            <br />
            This action cannot be undone.
          </DialogContentText>
          {error && (
            <Box sx={{ mt: 2, color: 'error.main' }}>
              <DialogContentText color="error">{error}</DialogContentText>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} color="primary" disabled={isDeleting}>
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
  );
};
