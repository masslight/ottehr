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

interface UseDeleteProcedureDialogProps {
  deleteProcedure: ({ procedureId, procedureName }: { procedureId: string; procedureName: string }) => Promise<boolean>;
}

interface UseDeleteProcedureDialogResult {
  showDeleteProcedureDialog: ({ procedureId, procedureName }: { procedureId: string; procedureName: string }) => void;
  DeleteProcedureDialog: ReactElement | null;
}

export const useDeleteProcedureDialog = ({
  deleteProcedure,
}: UseDeleteProcedureDialogProps): UseDeleteProcedureDialogResult => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [procedureIdToDelete, setProcedureIdToDelete] = useState<string>('');
  const [procedureNameToDelete, setProcedureNameToDelete] = useState<string>('');

  const showDeleteProcedureDialog = useCallback(
    ({ procedureId, procedureName }: { procedureId: string; procedureName: string }): void => {
      setProcedureIdToDelete(procedureId);
      setProcedureNameToDelete(procedureName);
      setIsDeleteDialogOpen(true);
      setDeleteError(null);
    },
    []
  );

  const closeDeleteDialog = useCallback((): void => {
    setIsDeleteDialogOpen(false);
    setDeleteError(null);
  }, []);

  const confirmDeleteProcedure = useCallback(async (): Promise<void> => {
    if (!procedureIdToDelete) {
      setDeleteError('No procedure selected for deletion');
      return;
    }

    setIsDeleting(true);

    try {
      const success = await deleteProcedure({
        procedureId: procedureIdToDelete,
        procedureName: procedureNameToDelete,
      });

      if (success) {
        setIsDeleteDialogOpen(false);
      } else {
        setDeleteError('Failed to delete procedure');
      }
    } catch (err) {
      console.error('Error confirming delete:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during deletion';
      setDeleteError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  }, [procedureIdToDelete, procedureNameToDelete, deleteProcedure]);

  const DeleteProcedureDialog = isDeleteDialogOpen ? (
    <Dialog open={isDeleteDialogOpen} onClose={closeDeleteDialog} maxWidth="sm" fullWidth>
      <form
        style={{ padding: '10px' }}
        onSubmit={(e) => {
          e.preventDefault();
          void confirmDeleteProcedure();
        }}
      >
        <DialogTitle variant="h5" color="primary.dark">
          Delete Procedure
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this procedure{' '}
            {procedureNameToDelete ? <strong>"{procedureNameToDelete}"</strong> : ''}?
          </DialogContentText>
          <DialogContentText sx={{ mt: 2, fontSize: '0.875rem', color: 'text.secondary' }}>
            The procedure will be deleted and will no longer appear in reports.
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
            {isDeleting ? 'Deleting Procedure...' : 'Delete Procedure'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  ) : null;

  return {
    showDeleteProcedureDialog,
    DeleteProcedureDialog,
  };
};
