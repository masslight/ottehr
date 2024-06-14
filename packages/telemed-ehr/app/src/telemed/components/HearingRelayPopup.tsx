import React, { ReactElement } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

interface HearingRelayPopupProps {
  onClose: () => void;
  isOpen: boolean;
}

const HearingRelayPopup = ({ onClose, isOpen }: HearingRelayPopupProps): ReactElement => {
  const buttonSx = {
    fontWeight: '700',
    textTransform: 'none',
    borderRadius: 6,
    mb: 2,
    ml: 1,
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      fullWidth
      disableScrollLock
      sx={{
        '.MuiPaper-root': {
          padding: 1,
          width: '444px',
          maxWidth: 'initial',
        },
      }}
    >
      <DialogTitle variant="h4" color="primary.dark" sx={{ width: '100%' }}>
        Patient requires a Hearing Impaired Relay Service (711)
      </DialogTitle>
      <DialogContent>
        <Typography>
          Patient requires a Hearing Impaired Relay Service (711). Patient number is (123) 456-7890.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'flex-end', mr: 3 }}>
        <Button onClick={onClose} color="primary" variant="contained" size="medium" sx={buttonSx}>
          OK, Got it
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default HearingRelayPopup;
