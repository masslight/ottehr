import { Box } from '@mui/system';
import { FC, useState } from 'react';
import { FieldValues } from 'react-hook-form';
import { ErrorDialog, PageForm } from 'ottehr-components';
import { useCreateInviteMutation } from '../waiting-room';

type InviteParticipantsFormProps = {
  isGetInvitesFetching: boolean;
  onInviteSuccess?: () => void;
};

export const InviteParticipantForm: FC<InviteParticipantsFormProps> = ({ onInviteSuccess }) => {
  const [inviteErrorDialogOpen, setInviteErrorDialogOpen] = useState<boolean>(false);
  const createInviteMutation = useCreateInviteMutation();

  const submitInviteParticipantForm = (data: FieldValues): void => {
    const inviteParams = {
      firstName: data.firstName,
      lastName: data.lastName,
      emailAddress: data.email,
      phoneNumber: data.phoneNumber,
    };

    createInviteMutation.mutate(inviteParams, {
      onError: () => {
        setInviteErrorDialogOpen(true);
      },
      onSuccess: () => {
        onInviteSuccess && onInviteSuccess();
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
            type: 'Text',
            name: 'phoneNumber',
            label: 'Phone number',
            format: 'Phone Number',
            required: true,
          },
          {
            type: 'Text',
            name: 'email',
            label: 'Email',
            format: 'Email',
            required: true,
          },
        ]}
        onSubmit={submitInviteParticipantForm}
        controlButtons={{
          loading: createInviteMutation.isLoading,
          submitLabel: 'Send invite',
          backButtonLabel: 'Close',
        }}
      />
      <ErrorDialog
        open={inviteErrorDialogOpen}
        title={'Error'}
        description={'todo'}
        closeButtonText={'Close'}
        handleClose={() => setInviteErrorDialogOpen(false)}
      />
    </Box>
  );
};
