import { Alert, Box, Snackbar } from '@mui/material';
import { FC, useState } from 'react';
import { FieldValues } from 'react-hook-form';
import PageForm from '../../../components/PageForm';
import { useCreateInviteMutation } from '../waiting-room';

type InviteParticipantsFormProps = {
  isGetInvitesFetching: boolean;
  onInviteSuccess?: () => void;
  onClose?: () => void;
};

export const InviteParticipantForm: FC<InviteParticipantsFormProps> = ({ onInviteSuccess, onClose }) => {
  const [inviteErrorSnackbarOpen, setInviteErrorSnackbarOpen] = useState<boolean>(false);
  const createInviteMutation = useCreateInviteMutation();

  const submitInviteParticipantForm = (data: FieldValues): void => {
    const inviteParams = {
      firstName: data.firstName,
      lastName: data.lastName,
      emailAddress: data.email,
      phoneNumber: data.phoneNumber,
    };

    createInviteMutation.mutate(inviteParams, {
      onSuccess: () => {
        if (onInviteSuccess) {
          onInviteSuccess();
        }
      },
      onError: () => {
        setInviteErrorSnackbarOpen(true);
      },
    });
  };

  return (
    <Box>
      <PageForm
        formElements={[
          {
            type: 'Text',
            name: 'firstName',
            label: 'First name',
            required: true,
            width: 6,
          },
          {
            type: 'Text',
            name: 'lastName',
            label: 'Last name',
            required: true,
            width: 6,
          },
          {
            type: 'Radio List',
            name: 'preferredContact',
            label: 'Preferred contact',
            required: true,
            radioOptions: [
              { label: 'Email', value: 'email' },
              { label: 'Phone', value: 'phone' },
            ],
            style: { display: 'flex', flexDirection: 'row' },
          },
          {
            type: 'Text',
            name: 'phoneNumber',
            label: 'Phone number',
            format: 'Phone Number',
            required: true,
            requireWhen: {
              question: 'preferredContact',
              operator: '=',
              answer: 'phone',
            },
          },
          {
            type: 'Text',
            name: 'email',
            label: 'Email address',
            format: 'Email',
            required: true,
            requireWhen: {
              question: 'preferredContact',
              operator: '=',
              answer: 'email',
            },
          },
        ]}
        onSubmit={submitInviteParticipantForm}
        controlButtons={{
          loading: createInviteMutation.isLoading,
          submitLabel: 'Send invite',
          backButtonLabel: 'Close',
          onBack: () => onClose?.(),
        }}
      />
      <Snackbar
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        open={inviteErrorSnackbarOpen}
        autoHideDuration={5000}
        onClose={() => setInviteErrorSnackbarOpen(false)}
      >
        <Alert onClose={() => setInviteErrorSnackbarOpen(false)} severity="error" variant="filled">
          Something went wrong while trying to invite a new participant. Please, try again.
        </Alert>
      </Snackbar>
    </Box>
  );
};
