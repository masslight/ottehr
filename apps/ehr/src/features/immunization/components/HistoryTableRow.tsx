import { DeleteOutlined as DeleteIcon, EditOutlined as EditIcon } from '@mui/icons-material';
import { IconButton, TableCell, TableRow, Typography } from '@mui/material';
import { Stack, useTheme } from '@mui/system';
import { enqueueSnackbar } from 'notistack';
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CustomDialog } from 'src/components/dialogs';
import { StatusChip } from 'src/features/immunization/components/StatusChip';
import { ImmunizationOrder } from '../ImmunizationOrder';

interface Props {
  historyEntry: ImmunizationOrder;
  showActions: boolean;
}

export const HistoryTableRow: React.FC<Props> = ({ historyEntry, showActions }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { id: appointmentId } = useParams();
  const [isDeleteDialogOpened, setIsDeleteDialogOpened] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const navigateToEditOrder = (): void => {
    if (!appointmentId) {
      enqueueSnackbar('navigation error', { variant: 'error' });
      return;
    }
    navigate('todo');
  };

  const handleConfirmDelete = async (): Promise<void> => {
    setIsDeleting(true);
    try {
      // todo await deleteMedication(medication.id);
      setIsDeleteDialogOpened(false);
    } catch (error) {
      console.error('Error deleting vaccine order:', error);
      enqueueSnackbar('An error occurred while deleting the vaccine order. Please try again.', { variant: 'error' });
    }
    setIsDeleting(false);
  };

  return (
    <TableRow>
      <TableCell>{historyEntry.vaccineName}</TableCell>
      <TableCell>
        {historyEntry.dose} {historyEntry.units} {historyEntry.route ? `/ ${historyEntry.route}` : null}
        <Typography sx={{ fontSize: '14px', color: '#00000099' }}>{historyEntry.instructions}</Typography>
      </TableCell>
      <TableCell>
        {historyEntry.orderedDate} {historyEntry.orderedTime}
        <Typography sx={{ fontSize: '14px', color: '#00000099' }}>{historyEntry.orderedBy.providerName}</Typography>
      </TableCell>
      <TableCell>
        {historyEntry.administeringData?.administeredDate} {historyEntry.administeringData?.administeredTime}
        <Typography sx={{ fontSize: '14px', color: '#00000099' }}>
          {historyEntry.administeringData?.providerName}
        </Typography>
      </TableCell>
      <TableCell>
        <Stack direction="row" justifyContent="space-between">
          <StatusChip status={historyEntry.status} style={'gray'} />
          {showActions ? (
            <Stack direction="row" onClick={(e) => e.stopPropagation()}>
              <IconButton size="small" aria-label="edit" onClick={navigateToEditOrder}>
                <EditIcon sx={{ color: theme.palette.primary.dark }} />
              </IconButton>
              <IconButton size="small" aria-label="delete" onClick={() => setIsDeleteDialogOpened(true)}>
                <DeleteIcon sx={{ color: theme.palette.warning.dark }} />
              </IconButton>
              <CustomDialog
                open={isDeleteDialogOpened}
                handleClose={() => setIsDeleteDialogOpened(false)}
                title="Delete vaccine order"
                description={`Are you sure you want to delete the vacine order?`}
                closeButtonText="Cancel"
                closeButton={false}
                handleConfirm={handleConfirmDelete}
                confirmText={isDeleting ? 'Deleting...' : 'Delete'}
                confirmLoading={isDeleting}
              />
            </Stack>
          ) : null}
        </Stack>
      </TableCell>
    </TableRow>
  );
};
