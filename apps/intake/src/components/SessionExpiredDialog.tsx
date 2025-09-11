import { useAuth0 } from '@auth0/auth0-react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, useTheme } from '@mui/material';
import { ReactElement, useCallback } from 'react';

interface SessionExpiredDialogProps {
  modalOpen: boolean;
}

export default function SessionExpiredDialog({ modalOpen }: SessionExpiredDialogProps): ReactElement {
  const theme = useTheme();
  const { logout } = useAuth0();

  const endSession = useCallback(() => {
    void logout({
      logoutParams: { returnTo: import.meta.env.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL, federated: true },
    });
  }, [logout]);

  const buttonSx = {
    fontWeight: 500,
    textTransform: 'none',
    borderRadius: 6,
  };

  return (
    <Dialog
      open={modalOpen}
      onClose={endSession}
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
        <Button variant="contained" onClick={endSession} size="medium" color="error" sx={buttonSx}>
          Log out now
        </Button>
      </DialogActions>
    </Dialog>
  );
}
