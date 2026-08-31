import { otherColors } from '@ehrTheme/colors';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Box, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { RoundedButton } from '../RoundedButton';
import { CustomDialog } from './CustomDialog';

interface PendingErxEnrollmentDialogProps {
  open: boolean;
  handleClose: () => void;
}

export const PendingErxEnrollmentDialog = ({ open, handleClose }: PendingErxEnrollmentDialogProps): ReactElement => (
  <CustomDialog
    open={open}
    handleClose={handleClose}
    title={
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Box
          sx={{
            width: '50px',
            height: '50px',
            backgroundColor: otherColors.lightBlue,
            borderRadius: '50%',
            border: '1px solid #C0DBFE',
            p: 1.5,
          }}
        >
          <ErrorOutlineIcon color="primary" />
        </Box>
      </Box>
    }
    description={
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography variant="body2">Your eRx enrollment is being reviewed.</Typography>
        <Typography variant="body2">Please check back in 24 hours.</Typography>
      </Box>
    }
    actions={
      <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <RoundedButton variant="contained" onClick={handleClose}>
          Ok
        </RoundedButton>
      </Box>
    }
    closeButton={false}
  />
);
