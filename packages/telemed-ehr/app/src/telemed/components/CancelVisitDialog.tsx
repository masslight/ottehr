import { LoadingButton } from '@mui/lab';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  Typography,
} from '@mui/material';
import React, { ReactElement, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cancelInPersonAppointment, cancelTelemedAppointment } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import { CancellationReasonOptions } from '../../types/types';

interface CancelVisitDialogProps {
  onClose: () => void;
  appointmentType: 'telemed' | 'in-person';
}

const CancelVisitDialog = ({ onClose, appointmentType }: CancelVisitDialogProps): ReactElement => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<boolean>(false);
  const [otherReason, setOtherReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const { zambdaIntakeClient } = useApiClients();
  const { id: appointmentID } = useParams();
  const navigate = useNavigate();

  const telemedCancellationReasons = [
    'Patient did not answer after multiple attempts',
    'Wrong patient name on chart',
    'Technical issues connecting and/ or with video',
    'Other',
  ];

  const cancellationReasons =
    appointmentType === 'telemed' ? telemedCancellationReasons : Object.values(CancellationReasonOptions);

  const handleReasonChange = (event: SelectChangeEvent<string>): void => {
    setReason(event.target.value);
    if (event.target.value !== 'Other') {
      setOtherReason('');
    }
  };

  const handleOtherReasonChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setOtherReason(event.target.value);
  };

  const handleCancelAppointment = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(false);
    if (!reason || (reason === 'Other' && !otherReason)) {
      return;
    }
    setIsCancelling(true);
    if (!zambdaIntakeClient) throw new Error('Zambda client not found');
    try {
      let response;
      if (appointmentType === 'telemed') {
        console.log('canceling telemed appointment', appointmentID, reason, otherReason);
        response = await cancelTelemedAppointment(zambdaIntakeClient, {
          appointmentID: appointmentID || '',
          cancellationReason: reason,
          cancellationReasonAdditional: otherReason,
        });
      }
      if (appointmentType === 'in-person') {
        response = await cancelInPersonAppointment(zambdaIntakeClient, {
          appointmentID: appointmentID || '',
          cancellationReason: reason as CancellationReasonOptions,
        });
      }
      console.log('Appointment cancelled successfully', response);
    } catch (error) {
      setError(true);
      console.error('Failed to cancel appointment', error);
    } finally {
      setIsCancelling(false);
      if (appointmentType === 'telemed') {
        navigate('/telemed/appointments');
      } else if (appointmentType === 'in-person') {
        navigate('/in-person/appointments');
      }
      onClose();
    }
  };

  const buttonSx = {
    fontWeight: '700',
    textTransform: 'none',
    borderRadius: 6,
    mb: 2,
    ml: 1,
  };

  return (
    <Dialog
      open={true}
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
      <form onSubmit={(e) => handleCancelAppointment(e)}>
        <DialogTitle variant="h4" color="primary.dark" sx={{ width: '100%' }}>
          Cancellation reason
        </DialogTitle>
        <DialogContent>
          <FormControl fullWidth required sx={{ mt: 2 }}>
            <InputLabel id="cancellation-reason-label">Cancellation Reason</InputLabel>
            <Select
              labelId="cancellation-reason-label"
              id="cancellation-reason"
              value={reason}
              label="Cancellation Reason"
              onChange={handleReasonChange}
            >
              {appointmentType}
              {cancellationReasons.map((reason) => (
                <MenuItem key={reason} value={reason}>
                  {reason}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {reason === 'Other' && (
            <FormControl fullWidth required>
              <TextField
                id="other-reason"
                label="Reason"
                variant="outlined"
                fullWidth
                required={true}
                margin="normal"
                value={otherReason}
                onChange={handleOtherReasonChange}
              />
            </FormControl>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'flex-start', marginLeft: 1 }}>
          <LoadingButton
            loading={isCancelling}
            type="submit"
            variant="contained"
            color="primary"
            size="medium"
            sx={buttonSx}
          >
            Cancel visit
          </LoadingButton>
          <Button onClick={onClose} variant="text" color="primary" size="medium" sx={buttonSx}>
            Keep
          </Button>
        </DialogActions>
        {error && (
          <Typography color="error" variant="body2" my={1} mx={2}>
            There was an error cancelling this appointment, please try again.
          </Typography>
        )}
      </form>
    </Dialog>
  );
};

export default CancelVisitDialog;
