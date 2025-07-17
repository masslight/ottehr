import { Typography } from '@mui/material';
import { FC } from 'react';
import { CustomDialog } from '../../../components/CustomDialog';
import { useGetVideoChatInvites } from '../waiting-room';
import { ManageParticipants } from './ManageParticipants';

type ManageParticipantsDialogProps = {
  onClose: () => void;
};

export const ManageParticipantsDialog: FC<ManageParticipantsDialogProps> = ({ onClose }) => {
  const { data: invitesData, isLoading, isFetching } = useGetVideoChatInvites();

  const handleClose = (): void => {
    onClose();
  };

  const title =
    isLoading || isFetching
      ? 'Loading...'
      : (invitesData?.invites?.length || 0) > 0
      ? 'Manage participants'
      : 'Invite participant';

  return (
    <CustomDialog PaperProps={{ sx: { maxWidth: '560px', borderRadius: 2 } }} open={true} onClose={handleClose}>
      <Typography variant="h2" color="primary.main" sx={{ pb: 3 }}>
        {title}
      </Typography>
      <ManageParticipants onClose={handleClose}></ManageParticipants>
    </CustomDialog>
  );
};
