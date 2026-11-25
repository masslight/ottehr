import { otherColors } from '@ehrTheme/colors';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';

interface ScheduleOverridesDialogProps {
  loading: boolean;
  handleClose: () => void;
  open: boolean;
  handleConfirm: () => void;
}

export default function ScheduleOverridesDialog({
  handleClose,
  open,
  loading,
  handleConfirm,
}: ScheduleOverridesDialogProps): ReactElement {
  return (
    <AppDialog
      variant="alert"
      open={open}
      onClose={handleClose}
      title="Schedule Change May Affect Visits"
      primary={{ label: 'Confirm Schedule Change', onClick: () => handleConfirm(), loading }}
    >
      Your changes will be applied immediately after confirmation. Please make sure that no previously booked visits are
      affected by this schedule change.
      <Box
        sx={{
          marginTop: 1,
          padding: 1,
          background: otherColors.dialogNote,
          borderRadius: '4px',
        }}
        display="flex"
      >
        <WarningAmberIcon sx={{ marginTop: 1, color: otherColors.warningIcon }} />
        <Typography variant="body2" color="#212130" sx={{ m: 1.25 }}>
          If there are conflicts in booked visits and new schedule, please contact patients to move their visits.
        </Typography>
      </Box>
    </AppDialog>
  );
}
