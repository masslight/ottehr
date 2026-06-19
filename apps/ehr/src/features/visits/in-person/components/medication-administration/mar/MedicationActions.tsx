import { DeleteOutlined as DeleteIcon, EditOutlined as EditIcon } from '@mui/icons-material';
import WarningIcon from '@mui/icons-material/Warning';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ExtendedMedicationDataForResponse, getApiError } from 'utils';
import { CustomDialog } from '../../../../../../components/dialogs/CustomDialog';
import { useMedicationManagement } from '../../../hooks/useMedicationManagement';
import { getEditOrderUrl } from '../../../routing/helpers';

interface MedicationActionsProps {
  medication: ExtendedMedicationDataForResponse;
}

export const MedicationActions: React.FC<MedicationActionsProps> = ({ medication }) => {
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
  // Delete is available only for pending medications
  const showDelete = isEditable;

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
      await deleteMedication(medication.id);
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

  const dialogTitle = (
    <Box display="flex" alignItems="center" color="error.main">
      <WarningIcon sx={{ mr: 1 }} />
      <Typography variant="h4">Delete Medication</Typography>
    </Box>
  );

  const navigateToEditOrder = (): void => {
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
      <CustomDialog
        open={isDeleteDialogOpen}
        handleClose={handleCloseDeleteDialog}
        title={dialogTitle}
        description={`Are you sure you want to delete the medication "${medication.medicationName}"?`}
        closeButtonText="Cancel"
        closeButton={false}
        handleConfirm={handleConfirmDelete}
        confirmText={isDeleting ? 'Deleting...' : 'Delete'}
        confirmLoading={isDeleting}
      />
    </Box>
  );
};
