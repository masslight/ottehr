import { DeleteOutlined as DeleteIcon, EditOutlined as EditIcon } from '@mui/icons-material';
import { Box, IconButton, useTheme } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { enqueueOrderDeleteWarnings } from 'src/features/visits/shared/utils/orderDeleteWarnings';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { ExtendedMedicationDataForResponse } from 'utils/lib/types/api/medication-administration.types';
import { useMedicationManagement } from '../../../hooks/useMedicationManagement';
import { getEditOrderUrl } from '../../../routing/helpers';

interface MedicationActionsProps {
  medication: ExtendedMedicationDataForResponse;
  onEditOrder?: (medicationId: string) => void;
}

export const MedicationActions: React.FC<MedicationActionsProps> = ({ medication, onEditOrder }) => {
  const theme = useTheme();
  const { canEditMedication, deleteMedication } = useMedicationManagement();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { id: appointmentId } = useParams();

  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (error) {
      enqueueSnackbar(error, { variant: 'error' });
    }
  }, [error]);

  const isCompleted =
    medication.status === 'administered' ||
    medication.status === 'administered-partly' ||
    medication.status === 'administered-not';
  const isEditable = canEditMedication(medication);
  // Edit is available for pending (edit order) and completed (view/edit completed details)
  const showEdit = isEditable || isCompleted;
  const showDelete = medication.status !== 'cancelled';

  if (!showEdit && !showDelete) {
    return null;
  }

  const handleDeleteClick = (): void => {
    setIsDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = (): void => {
    setIsDeleteDialogOpen(false);
    setError(null);
  };

  const handleConfirmDelete = async (): Promise<void> => {
    setIsDeleting(true);
    setError(null);
    try {
      enqueueOrderDeleteWarnings(await deleteMedication(medication.id));
      setIsDeleteDialogOpen(false);
    } catch (error) {
      const errorMessage = getApiError({
        error,
        defaultError: 'An error occurred while deleting the medication. Please try again.',
      });
      setError(errorMessage);
    }
    setIsDeleting(false);
  };

  const navigateToEditOrder = (): void => {
    if (onEditOrder) {
      onEditOrder(medication.id);
      return;
    }
    if (!appointmentId) {
      enqueueSnackbar('navigation error', { variant: 'error' });
      return;
    }
    navigate(getEditOrderUrl(appointmentId, medication.id));
  };

  return (
    <Box onClick={(e) => e.stopPropagation()}>
      {showEdit && (
        <IconButton size="small" aria-label="edit" onClick={navigateToEditOrder}>
          <EditIcon sx={{ color: theme.palette.primary.dark }} />
        </IconButton>
      )}
      {showDelete && (
        <IconButton size="small" aria-label="delete" onClick={handleDeleteClick}>
          <DeleteIcon sx={{ color: theme.palette.warning.dark }} />
        </IconButton>
      )}
      <AppDialog
        variant="destructive"
        open={isDeleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        title="Delete Medication"
        primary={{ label: 'Delete', onClick: handleConfirmDelete, loading: isDeleting }}
      >
        <span data-testid={dataTestIds.dialog.message}>
          {`Are you sure you want to delete the medication "${medication.medicationName}"?`}
        </span>
      </AppDialog>
    </Box>
  );
};
