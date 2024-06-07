import React, { ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  TextField,
  Typography,
} from '@mui/material';
import { useApiClients } from '../../hooks/useAppClients';
import { inviteParticipant } from '../../api/api';
import { useParams } from 'react-router-dom';
import { LoadingButton } from '@mui/lab';

interface InviteParticipantProps {
  modalOpen: boolean;
  onClose: () => void;
}

interface FormInputs {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

const buttonSx = {
  fontWeight: '700',
  textTransform: 'none',
  borderRadius: 6,
  mb: 2,
  ml: 1,
};

const InviteParticipant = ({ modalOpen, onClose }: InviteParticipantProps): ReactElement => {
  const { register, handleSubmit, formState } = useForm<FormInputs>({
    mode: 'onChange',
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<boolean>(false);
  const { zambdaIntakeClient } = useApiClients();
  const { id: appointmentID } = useParams();

  const onSubmit = async (data: FormInputs): Promise<void> => {
    setIsLoading(true);
    setError(false);
    if (!zambdaIntakeClient) throw new Error('Zambda client not found');
    try {
      const response = await inviteParticipant(zambdaIntakeClient, {
        appointmentId: appointmentID || '',
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phone,
        emailAddress: data.email,
      });
      console.log('Participant invited successfully', response);
      onClose();
    } catch (error) {
      setError(true);
      console.error('Failed to invite participant', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={modalOpen}
      onClose={onClose}
      fullWidth
      disableScrollLock
      sx={{ '.MuiPaper-root': { padding: 1, width: '444px', maxWidth: 'initial' } }}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle variant="h4" color="primary.dark" sx={{ width: '100%' }}>
          Invite Participant
        </DialogTitle>
        <DialogContent>
          <FormControl fullWidth required sx={{ mt: 2 }}>
            <TextField
              {...register('firstName', { required: true })}
              id="first-name"
              label="First Name"
              variant="outlined"
              fullWidth
              error={!!formState.errors.firstName}
              required
            />
          </FormControl>
          <FormControl fullWidth required sx={{ mt: 2 }}>
            <TextField
              {...register('lastName', { required: true })}
              id="last-name"
              label="Last Name"
              variant="outlined"
              fullWidth
              error={!!formState.errors.lastName}
              required
            />
          </FormControl>
          <FormControl fullWidth required sx={{ mt: 2 }}>
            <TextField
              {...register('phone', { required: true })}
              id="phone"
              label="Phone"
              variant="outlined"
              fullWidth
              error={!!formState.errors.phone}
              required
            />
          </FormControl>
          <FormControl fullWidth required sx={{ mt: 2 }}>
            <TextField
              {...register('email', { required: true })}
              id="email"
              label="Email"
              variant="outlined"
              fullWidth
              error={!!formState.errors.email}
              required
            />
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'flex-start', marginLeft: 1 }}>
          <LoadingButton
            loading={isLoading}
            type="submit"
            variant="contained"
            color="primary"
            size="medium"
            sx={buttonSx}
            disabled={!formState.isValid}
          >
            Send Invite
          </LoadingButton>
          <Button onClick={onClose} variant="text" color="primary" size="medium" sx={buttonSx}>
            Cancel
          </Button>
        </DialogActions>
        {error && (
          <Typography color="error" variant="body2" my={1} mx={2}>
            There was an error inviting this participant, please try again.
          </Typography>
        )}
      </form>
    </Dialog>
  );
};

export default InviteParticipant;
