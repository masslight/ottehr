import React, { ReactElement } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

interface PreferredLanguagePopupProps {
  onClose: () => void;
  preferredLanguage: string | undefined;
  isOpen: boolean;
}

const PreferredLanguagePopup = ({ onClose, preferredLanguage, isOpen }: PreferredLanguagePopupProps): ReactElement => {
  const language = preferredLanguage;

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
        Patient’s Preferred Language
      </DialogTitle>
      <DialogContent>
        <Typography>
          <strong>{language}</strong> is the preferred language for the patient. Please contact the language line if the
          patient needs an interpreter:
          <br />
          (123) 456-7890.
          <br />
          This number is always available in the bottom left corner of the screen.
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

export default PreferredLanguagePopup;
