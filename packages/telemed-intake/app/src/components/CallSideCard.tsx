import EastIcon from '@mui/icons-material/East';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import { Card, IconButton, List } from '@mui/material';
import { FC, useState } from 'react';
import { StyledListItemWithButton } from 'ottehr-components';
import { otherColors } from '../IntakeThemeProvider';
import { ManageParticipantsDialog } from './ManageParticipantsDialog';
import { PatientPhotosDialog } from './PatientPhotosDialog';

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
        minWidth: isCardExpanded ? '256px' : '56px',
        width: isCardExpanded ? '256px' : '56px',
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
        <StyledListItemWithButton
          primaryText="Manage participants"
          secondaryText="Oliver Black, Jerome Black"
          hideText={!isCardExpanded}
          onClick={() => setManageParticipantsDialogOpen(true)}
        >
          <ManageAccountsOutlinedIcon sx={{ color: otherColors.purple }} />
        </StyledListItemWithButton>
        <StyledListItemWithButton
          primaryText="Upload photos"
          secondaryText="2 photos attached"
          noDivider
          hideText={!isCardExpanded}
          onClick={() => setUploadPhotosDialogOpen(true)}
        >
          <PhotoLibraryOutlinedIcon sx={{ color: otherColors.purple }} />
        </StyledListItemWithButton>
      </List>

      {isManageParticipantsDialogOpen ? (
        <ManageParticipantsDialog onClose={() => setManageParticipantsDialogOpen(false)} />
      ) : null}
      {isUploadPhotosDialogOpen ? <PatientPhotosDialog onClose={() => setUploadPhotosDialogOpen(false)} /> : null}
    </Card>
  );
};
