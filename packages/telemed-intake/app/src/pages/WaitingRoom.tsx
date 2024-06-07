import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import { Box, List, Typography, useTheme } from '@mui/material';
import { Duration } from 'luxon';
import { useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { IntakeThemeContext, StyledListItemWithButton, safelyCaptureException } from 'ottehr-components';
import { getSelectors } from 'ottehr-utils';
import { IntakeFlowPageRoute } from '../App';
import { clockFullColor } from '../assets';
import { CancelVisitDialog } from '../components';
import { useAppointmentStore } from '../features/appointments';
import { CustomContainer } from '../features/common';
import { InvitedParticipantListItemButton, ManageParticipantsDialog } from '../features/invited-participants';
import { createIOSMesssageCallStarted, sendIOSAppMessage } from '../features/ios-communication';
import { useIOSAppSync } from '../features/ios-communication/useIOSAppSync';
import { UploadPhotosDialog, UploadPhotosListItemButton } from '../features/upload-photos';
import { useGetWaitStatus, useWaitingRoomStore } from '../features/waiting-room';

const WaitingRoom = (): JSX.Element => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { otherColors } = useContext(IntakeThemeContext);
  const { estimatedTime } = getSelectors(useWaitingRoomStore, ['estimatedTime']);
  const [searchParams, _] = useSearchParams();
  const urlAppointmentID = searchParams.get('appointment_id');
  const location = useLocation();
  const isInvitedParticipant = location.pathname === IntakeFlowPageRoute.InvitedWaitingRoom.path;
  const appointmentID = useAppointmentStore((state) => state.appointmentID);

  useEffect(() => {
    if (urlAppointmentID) {
      useAppointmentStore.setState(() => ({ appointmentID: urlAppointmentID }));
    }
  }, [urlAppointmentID]);

  const { isIOSApp } = useIOSAppSync();
  const [isManageParticipantsDialogOpen, setManageParticipantsDialogOpen] = useState<boolean>(false);
  const [isUploadPhotosDialogOpen, setUploadPhotosDialogOpen] = useState<boolean>(false);
  const [isCancelVisitDialogOpen, setCancelVisitDialogOpen] = useState<boolean>(false);

  useGetWaitStatus((data) => {
    useWaitingRoomStore.setState(data);
    if (data.status == 'on-video') {
      if (isIOSApp && appointmentID) {
        try {
          sendIOSAppMessage(createIOSMesssageCallStarted({ appointmentID }));
          return;
        } catch (error) {
          safelyCaptureException(error);
        }
      }
      if (isInvitedParticipant) {
        const url = new URL(window.location.href);
        navigate(IntakeFlowPageRoute.InvitedVideoCall.path + url.search);
      } else {
        navigate(IntakeFlowPageRoute.VideoCall.path);
      }
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

      {isInvitedParticipant ? (
        <List sx={{ p: 0 }}>
          <StyledListItemWithButton
            primaryText="Call settings & Test"
            secondaryText="Audio, video, microphone"
            noDivider
          >
            <AssignmentOutlinedIcon sx={{ color: otherColors.purple }} />
          </StyledListItemWithButton>
        </List>
      ) : (
        <List sx={{ p: 0 }}>
          <InvitedParticipantListItemButton onClick={() => setManageParticipantsDialogOpen(true)} hideText={false} />

          <UploadPhotosListItemButton onClick={() => setUploadPhotosDialogOpen(true)} hideText={false} />

          <StyledListItemWithButton
            onClick={() => navigate('/home')}
            primaryText="Leave waiting room"
            secondaryText="We will notify you once the call starts"
          >
            <img alt="Clock icon" src={clockFullColor} width={24} />
          </StyledListItemWithButton>

          <StyledListItemWithButton
            onClick={() => setCancelVisitDialogOpen(true)}
            primaryText="Cancel visit"
            secondaryText="You will not be charged if you cancel the visit"
            noDivider
          >
            <CancelOutlinedIcon sx={{ color: otherColors.clearImage }} />
          </StyledListItemWithButton>
        </List>
      )}

      {isManageParticipantsDialogOpen ? (
        <ManageParticipantsDialog onClose={() => setManageParticipantsDialogOpen(false)} />
      ) : null}
      {isUploadPhotosDialogOpen ? <UploadPhotosDialog onClose={() => setUploadPhotosDialogOpen(false)} /> : null}
      {isCancelVisitDialogOpen ? <CancelVisitDialog onClose={() => setCancelVisitDialogOpen(false)} /> : null}
    </CustomContainer>
  );
};

export default WaitingRoom;
