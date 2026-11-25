import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  Typography,
} from '@mui/material';
import React, { ReactElement, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cancelTelemedAppointment } from 'src/api/api';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { useApiClients } from 'src/hooks/useAppClients';
import { VALUE_SETS } from 'utils/lib/ottehr-config/value-sets';

interface CancelVisitDialogProps {
  onClose: () => void;
}

const CancelVisitDialog = ({ onClose }: CancelVisitDialogProps): ReactElement => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<boolean>(false);
  const [otherReason, setOtherReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const { oystehrZambda } = useApiClients();
  const { id: appointmentID } = useParams();
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  const cancellationReasons = VALUE_SETS.cancelReasonOptionsVirtualProvider;

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
    if (!oystehrZambda) throw new Error('Zambda client not found');

    const typedReason = cancellationReasons.find((r) => r.value === reason);

    if (!typedReason) {
      throw new Error(`Invalid cancellation reason: ${reason}`);
    }

    let errorReceived = false;
    try {
      const response = await cancelTelemedAppointment(oystehrZambda, {
        appointmentID: appointmentID || '',
        cancellationReason: typedReason.value,
        cancellationReasonAdditional: otherReason,
      });
      console.log('Appointment cancelled successfully', response);
    } catch (error) {
      setError(true);
      errorReceived = true;
      console.error('Failed to cancel appointment', error);
    } finally {
      setIsCancelling(false);
      if (!errorReceived) {
        onClose();
        navigate('/visits');
      }
    }
  };

  return (
    <AppDialog
      variant="destructive"
      open={true}
      onClose={onClose}
      title="Cancellation Reason"
      // Submitting through the form keeps the browser's required-field validation.
      primary={{ label: 'Cancel Visit', onClick: () => formRef.current?.requestSubmit(), loading: isCancelling }}
      dismiss={{ label: 'Keep' }}
    >
      <form ref={formRef} onSubmit={(e) => handleCancelAppointment(e)}>
        <FormControl fullWidth required sx={{ mt: 2 }}>
          <InputLabel id="cancellation-reason-label">Cancellation Reason</InputLabel>
          <Select
            labelId="cancellation-reason-label"
            id="cancellation-reason"
            value={reason}
            label="Cancellation Reason"
            onChange={handleReasonChange}
          >
            {cancellationReasons.map((reason) => (
              <MenuItem key={reason.value} value={reason.value}>
                {reason.label}
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
        {/* Lets Enter in a field submit, as the old submit button did. */}
        <input type="submit" hidden />
        {error && (
          <Typography color="error" variant="body2" mt={1}>
            There was an error cancelling this appointment, please try again.
          </Typography>
        )}
      </form>
    </AppDialog>
  );
};

export default CancelVisitDialog;
