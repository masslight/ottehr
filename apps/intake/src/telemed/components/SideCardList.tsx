import { List } from '@mui/material';
import { FC, useState } from 'react';
import { InvitedParticipantListItemButton, ManageParticipantsDialog } from '../features/invited-participants';
import { UploadPhotosDialog, UploadPhotosListItemButton } from '../features/upload-photos';

type SideCardListProps = {
  isCardExpanded: boolean;
};

export const SideCardList: FC<SideCardListProps> = ({ isCardExpanded }) => {
  const [isManageParticipantsDialogOpen, setManageParticipantsDialogOpen] = useState<boolean>(false);
  const [isUploadPhotosDialogOpen, setUploadPhotosDialogOpen] = useState<boolean>(false);

  return (
    <>
      <List sx={{ p: 0 }}>
        <InvitedParticipantListItemButton
          onClick={() => setManageParticipantsDialogOpen(true)}
          hideText={!isCardExpanded}
        />

        <UploadPhotosListItemButton onClick={() => setUploadPhotosDialogOpen(true)} hideText={!isCardExpanded} />
      </List>

      {isManageParticipantsDialogOpen ? (
        <ManageParticipantsDialog onClose={() => setManageParticipantsDialogOpen(false)} />
      ) : null}
      {isUploadPhotosDialogOpen ? <UploadPhotosDialog onClose={() => setUploadPhotosDialogOpen(false)} /> : null}
    </>
  );
};
