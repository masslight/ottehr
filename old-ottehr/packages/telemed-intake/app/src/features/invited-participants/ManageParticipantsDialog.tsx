import { Typography } from '@mui/material';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomDialog } from 'ottehr-components';
import { useGetVideoChatInvites } from '../waiting-room';
import { ManageParticipants } from './ManageParticipants';

type ManageParticipantsDialogProps = {
  onClose: () => void;
};

export const ManageParticipantsDialog: FC<ManageParticipantsDialogProps> = ({ onClose }) => {
  const { data: invitesData, isLoading, isFetching } = useGetVideoChatInvites();
  const { t } = useTranslation();

  const handleClose = (): void => {
    onClose();
  };

  const title =
    isLoading || isFetching
      ? t('general.loading')
      : (invitesData?.invites?.length || 0) > 0
        ? t('participants.manageParticipants')
        : t('participants.inviteParticipant');

  return (
    <CustomDialog PaperProps={{ sx: { maxWidth: '560px' } }} open={true} onClose={handleClose}>
      <Typography variant="h2" color="primary.main" sx={{ pb: 3 }}>
        {title}
      </Typography>
      <ManageParticipants onClose={handleClose}></ManageParticipants>
    </CustomDialog>
  );
};
