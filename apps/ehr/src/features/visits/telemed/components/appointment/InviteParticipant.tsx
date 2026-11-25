import { FormControl, TextField, Typography } from '@mui/material';
import React, { ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import { inviteParticipant } from 'src/api/api';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { useApiClients } from 'src/hooks/useAppClients';

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

const InviteParticipant = ({ modalOpen, onClose }: InviteParticipantProps): ReactElement => {
  const { register, handleSubmit, formState } = useForm<FormInputs>({
    mode: 'onChange',
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<boolean>(false);
  const { oystehrZambda } = useApiClients();
  const { id: appointmentID } = useParams();

  const onSubmit = async (data: FormInputs): Promise<void> => {
    setIsLoading(true);
    setError(false);
    if (!oystehrZambda) throw new Error('Zambda client not found');
    try {
      const response = await inviteParticipant(oystehrZambda, {
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
    <AppDialog
      variant="form"
      size="s"
      open={modalOpen}
      onClose={onClose}
      title="Invite Participant"
      onSubmit={handleSubmit(onSubmit)}
      primary={{ label: 'Send Invite', loading: isLoading, disabled: !formState.isValid }}
    >
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
        {error && (
          <Typography color="error" variant="body2" mt={2}>
            There was an error inviting this participant, please try again.
          </Typography>
        )}
    </AppDialog>
  );
};

export default InviteParticipant;
