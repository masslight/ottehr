import EastIcon from '@mui/icons-material/East';
import { Card, IconButton, List } from '@mui/material';
import { FC, useState } from 'react';
import { InvitedParticipantListItemButton, ManageParticipantsDialog } from '../features/invited-participants';
import { UploadPhotosDialog, UploadPhotosListItemButton } from '../features/upload-photos';

export const CallSideCard: FC = () => {
  const [isCardExpanded, setIsCardExpanded] = useState(true);
  const [isManageParticipantsDialogOpen, setManageParticipantsDialogOpen] = useState<boolean>(false);
  const [isUploadPhotosDialogOpen, setUploadPhotosDialogOpen] = useState<boolean>(false);

  const toggleCard = (): void => {
    setIsCardExpanded((prevState) => !prevState);
  };

  return (
    <Card
      sx={{
        flex: '1 auto',
        py: 5,
        px: isCardExpanded ? 5 : 2,
        borderRadius: 2,
        boxShadow: 0,
        position: 'relative',
        minWidth: isCardExpanded ? '347px' : '86px',
        width: isCardExpanded ? '347px' : '86px',
        transition: 'all 0.5s',
      }}
    >
      <IconButton onClick={toggleCard} size="small" sx={{ position: 'absolute', left: 7, top: 7 }}>
        <EastIcon
          sx={{
            transition: 'transform 0.5s',
            transform: isCardExpanded ? 'rotate(0deg)' : 'rotate(180deg)',
          }}
        />
      </IconButton>
      <List sx={{ p: 0 }}>
        <InvitedParticipantListItemButton
          onClick={() => setManageParticipantsDialogOpen(true)}
          hideText={!isCardExpanded}
        />

        <UploadPhotosListItemButton onClick={() => setUploadPhotosDialogOpen(true)} hideText={false} />
      </List>

      {isManageParticipantsDialogOpen ? (
        <ManageParticipantsDialog onClose={() => setManageParticipantsDialogOpen(false)} />
      ) : null}
      {isUploadPhotosDialogOpen ? <UploadPhotosDialog onClose={() => setUploadPhotosDialogOpen(false)} /> : null}
    </Card>
  );
};
