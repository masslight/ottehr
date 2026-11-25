import { Typography } from '@mui/material';
import { ReactElement } from 'react';
import { AppDialog } from './AppDialog';

interface PendingErxEnrollmentDialogProps {
  open: boolean;
  handleClose: () => void;
}

export const PendingErxEnrollmentDialog = ({ open, handleClose }: PendingErxEnrollmentDialogProps): ReactElement => (
  <AppDialog variant="alert" open={open} onClose={handleClose} title="eRX Pending Review">
    <Typography variant="body2">Your eRx enrollment is being reviewed.</Typography>
    <Typography variant="body2">Please check back in 24 hours.</Typography>
  </AppDialog>
);
