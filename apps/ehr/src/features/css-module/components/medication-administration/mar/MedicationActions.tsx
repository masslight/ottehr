import { otherColors } from '@ehrTheme/colors';
import { DeleteOutlined as DeleteIcon, EditOutlined as EditIcon } from '@mui/icons-material';
import PriorityHighOutlinedIcon from '@mui/icons-material/PriorityHighOutlined';
import WarningIcon from '@mui/icons-material/Warning';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GenericToolTip } from 'src/components/GenericToolTip';
import { ExtendedMedicationDataForResponse } from 'utils';
import { CustomDialog } from '../../../../../components/dialogs/CustomDialog';
import { useMedicationManagement } from '../../../hooks/useMedicationManagement';
import { getEditOrderUrl } from '../../../routing/helpers';
import { InteractionAlertsDialog } from '../InteractionAlertsDialog';
import { interactionsSummary } from '../util';

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
  const [showInteractionAlerts, setShowInteractionAlerts] = useState(false);

  useEffect(() => {
    if (error) {
      enqueueSnackbar(error, { variant: 'error' });
    }
  }, [error]);

  const isEditable = canEditMedication(medication);

  if (!isEditable) {
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
      console.error('Error deleting medication:', error);
      setError('An error occurred while deleting the medication. Please try again.');
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
      <IconButton size="small" aria-label="edit" onClick={navigateToEditOrder}>
        <EditIcon sx={{ color: theme.palette.primary.dark }} />
      </IconButton>
      <IconButton size="small" aria-label="delete" onClick={handleDeleteClick}>
        <DeleteIcon sx={{ color: theme.palette.warning.dark }} />
      </IconButton>
      {medication.interactions ? (
        <GenericToolTip
          title={
            'Interactions: ' + interactionsSummary(medication.interactions) + '. Click on alert icon to see details'
          }
          customWidth="500px"
          placement="top"
        >
          <IconButton onClick={() => setShowInteractionAlerts(true)}>
            <PriorityHighOutlinedIcon
              style={{
                width: '15px',
                height: '15px',
                color: '#FFF',
                background: otherColors.priorityHighIcon,
                borderRadius: '4px',
                padding: '1px 2px 1px 2px',
              }}
            />
          </IconButton>
        </GenericToolTip>
      ) : null}
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
      {showInteractionAlerts ? (
        <InteractionAlertsDialog
          medicationName={medication.medicationName}
          interactions={medication.interactions ?? {}}
          readonly={true}
          onCancel={() => setShowInteractionAlerts(false)}
        />
      ) : null}
    </Box>
  );
};
