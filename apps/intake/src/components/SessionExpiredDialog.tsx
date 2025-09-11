import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, useTheme } from '@mui/material';
import { ReactElement } from 'react';

interface SessionExpiredDialogProps {
  modalOpen: boolean;
  onEnd: () => void;
}

export default function SessionExpiredDialog({ modalOpen, onEnd }: SessionExpiredDialogProps): ReactElement {
  const theme = useTheme();

  const buttonSx = {
    fontWeight: 500,
    textTransform: 'none',
    borderRadius: 6,
  };

  return (
    <Dialog
      open={modalOpen}
      onClose={onEnd}
      disableScrollLock
      sx={{
        '.MuiPaper-root': {
          padding: 2,
        },
      }}
    >
      <DialogTitle variant="h4" color="primary.dark" sx={{ width: '80%' }}>
        Your session has expired
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: theme.palette.text.primary }}>
          Your session has expired and we encountered a problem refreshing it. Please log in again.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onEnd} size="medium" color="error" sx={buttonSx}>
          Log out now
        </Button>
      </DialogActions>
    </Dialog>
  );
}
