import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, useTheme } from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';

interface LogoutWarningProps {
  modalOpen: boolean;
  onEnd: () => void;
  onContinue: () => void;
  timeoutInSeconds: number;
}

export default function LogoutWarning({
  modalOpen,
  onEnd,
  onContinue,
  timeoutInSeconds,
}: LogoutWarningProps): ReactElement {
  const theme = useTheme();
  const [countdown, setCountdown] = useState(timeoutInSeconds);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    if (modalOpen) {
      setCountdown(timeoutInSeconds);

      intervalId = setInterval(() => {
        setCountdown((prevCountdown) => {
          if (prevCountdown <= 1) {
            clearInterval(intervalId);
            onEnd();
            return 0;
          }
          return prevCountdown - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [modalOpen, timeoutInSeconds, onEnd]);

  const handleContinue = (): void => {
    setCountdown(timeoutInSeconds);
    onContinue();
  };

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
        Your session is about to expire
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: theme.palette.text.primary }}>
          You will be logged out in {countdown} seconds due to inactivity.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={handleContinue} size="medium" sx={buttonSx}>
          Continue session
        </Button>
        <Button variant="contained" onClick={onEnd} size="medium" color="error" sx={buttonSx}>
          End session
        </Button>
      </DialogActions>
    </Dialog>
  );
}
