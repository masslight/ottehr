import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import { Box, List, Typography, useTheme } from '@mui/material';
import { Duration } from 'luxon';
import { useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IntakeThemeContext, StyledListItemWithButton, safelyCaptureException } from 'ottehr-components';
import { getSelectors } from 'ottehr-utils';
import { IntakeFlowPageRoute } from '../App';
import { clockFullColor } from '@theme/icons';
import { CancelVisitDialog } from '../components';
import { useAppointmentStore } from '../features/appointments';
import { CustomContainer } from '../features/common';
import { InvitedParticipantListItemButton, ManageParticipantsDialog } from '../features/invited-participants';
import { createIOSMesssageCallStarted, sendIOSAppMessage } from '../features/ios-communication';
import { useIOSAppSync } from '../features/ios-communication/useIOSAppSync';
import { UploadPhotosDialog, UploadPhotosListItemButton } from '../features/upload-photos';
import { useGetWaitStatus, useWaitingRoomStore } from '../features/waiting-room';

const waitingRoomDisabled = import.meta.env.VITE_APP_WAITING_ROOM_DISABLED == 'true';

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
  const { t } = useTranslation();

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
      title={t('waitingRoom.title')}
      img={t('waitingRoom.imgAlt') ? clockFullColor : undefined}
      imgAlt={t('waitingRoom.imgAlt')}
      imgWidth={80}
      subtext={t('waitingRoom.subtext')}
      bgVariant={IntakeFlowPageRoute.WaitingRoom.path}
    >
      {!waitingRoomDisabled && (
        <>
          <Box
            sx={{
              backgroundColor: otherColors.lightBlue,
              color: theme.palette.secondary.main,
              padding: 2,
              marginBottom: 3,
              marginTop: 3,
              borderRadius: '8px',
            }}
          >
            <Typography variant="subtitle1" color={theme.palette.primary.main}>
              {t('waitingRoom.approxWaitTime', {
                estimatedTime: estimatedTime
                  ? Duration.fromMillis(estimatedTime).toFormat("mm'mins'")
                  : t('waitingRoom.fallbackWaitTime'),
              })}
            </Typography>
          </Box>

          {isInvitedParticipant ? (
            <List sx={{ p: 0 }}>
              <StyledListItemWithButton
                primaryText={t('waitingRoom.callSettingsTitle')}
                secondaryText={t('waitingRoom.callSettingsSubtext')}
                noDivider
              >
                <AssignmentOutlinedIcon sx={{ color: otherColors.purple }} />
              </StyledListItemWithButton>
            </List>
          ) : (
            <List sx={{ p: 0 }}>
              <InvitedParticipantListItemButton
                onClick={() => setManageParticipantsDialogOpen(true)}
                hideText={false}
              />

              <UploadPhotosListItemButton onClick={() => setUploadPhotosDialogOpen(true)} hideText={false} />

              <StyledListItemWithButton
                onClick={() => navigate('/home')}
                primaryText={t('waitingRoom.leaveRoomTitle')}
                secondaryText={t('waitingRoom.leaveRoomSubtext')}
              >
                <img alt="Clock icon" src={clockFullColor} width={24} />
              </StyledListItemWithButton>

              <StyledListItemWithButton
                onClick={() => setCancelVisitDialogOpen(true)}
                primaryText={t('waitingRoom.cancelVisitTitle')}
                secondaryText={t('waitingRoom.cancelVisitSubtext')}
                noDivider
              >
                <CancelOutlinedIcon sx={{ color: otherColors.clearImage }} />
              </StyledListItemWithButton>
            </List>
          )}
        </>
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
