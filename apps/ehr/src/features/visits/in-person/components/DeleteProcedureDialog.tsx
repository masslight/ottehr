import { Box } from '@mui/material';
import { ReactElement, useCallback, useState } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';

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
    <AppDialog
      variant="destructive"
      open={isDeleteDialogOpen}
      onClose={closeDeleteDialog}
      title="Delete Procedure"
      primary={{ label: 'Delete Procedure', onClick: confirmDeleteProcedure, loading: isDeleting }}
    >
      <Box>
        Are you sure you want to delete this procedure{' '}
        {procedureNameToDelete ? <strong>"{procedureNameToDelete}"</strong> : ''}?
      </Box>
      <Box sx={{ mt: 2, color: 'text.secondary' }}>
        The procedure will be deleted and will no longer appear in reports.
      </Box>
      {deleteError && <Box sx={{ mt: 2, color: 'error.main' }}>{deleteError}</Box>}
    </AppDialog>
  ) : null;

  return {
    showDeleteProcedureDialog,
    DeleteProcedureDialog,
  };
};
