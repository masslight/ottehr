import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import MedicationOutlinedIcon from '@mui/icons-material/MedicationOutlined';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import { Box, List, Typography, useTheme } from '@mui/material';
import { Duration } from 'luxon';
import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IntakeThemeContext, StyledListItemWithButton } from 'ottehr-components';
import { getSelectors } from 'ottehr-utils';
import { IntakeFlowPageRoute } from '../App';
import { clockFullColor } from '../assets';
import { ManageParticipantsDialog, PatientPhotosDialog } from '../components';
import { CustomContainer } from '../features/common';
import { useGetWaitStatus, useWaitingRoomStore } from '../features/waiting-room';
import { useZapEHRAPIClient } from '../utils';

const WaitingRoom = (): JSX.Element => {
  const navigate = useNavigate();
  const theme = useTheme();
  const apiClient = useZapEHRAPIClient();
  const { otherColors } = useContext(IntakeThemeContext);
  const { estimatedTime } = getSelectors(useWaitingRoomStore, ['estimatedTime']);

  const [isManageParticipantsDialogOpen, setManageParticipantsDialogOpen] = useState<boolean>(false);
  const [isUploadPhotosDialogOpen, setUploadPhotosDialogOpen] = useState<boolean>(false);

  useGetWaitStatus(apiClient, (data) => {
    useWaitingRoomStore.setState(data);
    if (data.encounterId) {
      navigate(IntakeFlowPageRoute.VideoCall.path);
    }
  });

  return (
    <CustomContainer
      title="Waiting room"
      img={clockFullColor}
      imgAlt="Clock icon"
      imgWidth={80}
      subtext="Please wait, call will start automatically. A pediatric expert will connect with you soon."
      bgVariant={IntakeFlowPageRoute.WaitingRoom.path}
    >
      <Box
        sx={{
          backgroundColor: otherColors.lightPurpleAlt,
          color: theme.palette.secondary.main,
          padding: 2,
          marginBottom: 3,
          marginTop: 3,
          borderRadius: '8px',
        }}
      >
        <Typography variant="subtitle1" color={theme.palette.primary.main}>
          Approx. wait time - {estimatedTime ? Duration.fromMillis(estimatedTime).toFormat("mm'mins'") : '...mins'}
        </Typography>
      </Box>

      <List sx={{ p: 0 }}>
        <StyledListItemWithButton
          primaryText="View visit details"
          secondaryText="Review and edit patient information and paperwork"
        >
          <AssignmentOutlinedIcon sx={{ color: otherColors.purple }} />
        </StyledListItemWithButton>

        <StyledListItemWithButton primaryText="View pharmacy information" secondaryText="Green pharmacy">
          <MedicationOutlinedIcon sx={{ color: otherColors.purple }} />
        </StyledListItemWithButton>

        <StyledListItemWithButton
          onClick={() => setManageParticipantsDialogOpen(true)}
          primaryText="Manage participants"
          secondaryText="Oliver Black, Jerome Black"
        >
          <ManageAccountsOutlinedIcon sx={{ color: otherColors.purple }} />
        </StyledListItemWithButton>

        <StyledListItemWithButton
          onClick={() => setUploadPhotosDialogOpen(true)}
          primaryText="Upload photos"
          secondaryText="2 photos attached"
        >
          <PhotoLibraryOutlinedIcon sx={{ color: otherColors.purple }} />
        </StyledListItemWithButton>

        <StyledListItemWithButton
          primaryText="Leave waiting room"
          secondaryText="We will notify you one the call starts"
        >
          <img alt="Clock icon" src={clockFullColor} width={24} />
        </StyledListItemWithButton>

        <StyledListItemWithButton
          primaryText="Cancel visit"
          secondaryText="You will not be charged if you cancel the visit"
          noDivider
        >
          <CancelOutlinedIcon sx={{ color: otherColors.clearImage }} />
        </StyledListItemWithButton>
      </List>

      {isManageParticipantsDialogOpen ? (
        <ManageParticipantsDialog onClose={() => setManageParticipantsDialogOpen(false)} />
      ) : null}
      {isUploadPhotosDialogOpen ? <PatientPhotosDialog onClose={() => setUploadPhotosDialogOpen(false)} /> : null}
    </CustomContainer>
  );
};

export default WaitingRoom;
