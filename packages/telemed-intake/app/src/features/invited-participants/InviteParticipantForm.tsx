import { Box } from '@mui/system';
import { FC, useState } from 'react';
import { FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ErrorDialog, PageForm } from 'ottehr-components';
import { useCreateInviteMutation } from '../waiting-room';

type InviteParticipantsFormProps = {
  isGetInvitesFetching: boolean;
  onInviteSuccess?: () => void;
};

export const InviteParticipantForm: FC<InviteParticipantsFormProps> = ({ onInviteSuccess }) => {
  const [inviteErrorDialogOpen, setInviteErrorDialogOpen] = useState<boolean>(false);
  const createInviteMutation = useCreateInviteMutation();
  const { t } = useTranslation();

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
            label: t('general.formElement.labels.firstName'),
            required: true,
            width: 6,
          },
          {
            type: 'Text',
            name: 'lastName',
            label: t('general.formElement.labels.lastName'),
            required: true,
            width: 6,
          },
          {
            type: 'Text',
            name: 'phoneNumber',
            label: t('general.formElement.labels.phoneNumber'),
            format: 'Phone Number',
            required: true,
          },
          {
            type: 'Text',
            name: 'email',
            label: t('general.formElement.labels.email'),
            format: 'Email',
            required: true,
          },
        ]}
        onSubmit={submitInviteParticipantForm}
        controlButtons={{
          loading: createInviteMutation.isLoading,
          submitLabel: t('participants.sendInvite'),
          backButtonLabel: t('general.button.close'),
        }}
      />
      <ErrorDialog
        open={inviteErrorDialogOpen}
        title={t('participants.inviteError.title')}
        description={t('participants.inviteError.description')}
        closeButtonText={t('general.button.close')}
        handleClose={() => setInviteErrorDialogOpen(false)}
      />
    </Box>
  );
};
