import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import React, { ReactElement } from 'react';
import { getQuestionnaireResponseByLinkId } from 'utils';
import { getSelectors } from '../../shared/store/getSelectors';
import { useAppointmentStore } from '../state';

interface HearingRelayPopupProps {
  onClose: () => void;
  isOpen: boolean;
}

const HearingRelayPopup = ({ onClose, isOpen }: HearingRelayPopupProps): ReactElement => {
  const { questionnaireResponse } = getSelectors(useAppointmentStore, ['questionnaireResponse']);

  const patientPhoneNumber =
    getQuestionnaireResponseByLinkId('patient-number', questionnaireResponse)?.answer?.[0]?.valueString ||
    getQuestionnaireResponseByLinkId('guardian-number', questionnaireResponse)?.answer?.[0]?.valueString ||
    '';

  const buttonSx = {
    fontWeight: 500,
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
        <Typography>{`Patient requires a Hearing Impaired Relay Service (711). Patient number is ${patientPhoneNumber}.`}</Typography>
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
