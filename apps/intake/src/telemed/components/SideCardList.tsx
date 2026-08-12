import { List } from '@mui/material';
import { FC, useState } from 'react';
import { InvitedParticipantListItemButton } from 'src/telemed/features/invited-participants/InvitedParticipantsListItemButton';
import { ManageParticipantsDialog } from 'src/telemed/features/invited-participants/ManageParticipantsDialog';
import { UploadPhotosDialog } from 'src/telemed/features/upload-photos/UploadPhotosDialog';
import { UploadPhotosListItemButton } from 'src/telemed/features/upload-photos/UploadPhotosListItemButton';

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
