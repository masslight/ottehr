import { Container } from '@mui/material';
import {
  DeviceLabels,
  GlobalStyles,
  lightTheme,
  MeetingProvider,
  MeetingStatus,
  useAudioInputs,
  useAudioVideo,
  useLocalVideo,
  useMeetingManager,
  useMeetingStatus,
  useVideoInputs,
} from 'amazon-chime-sdk-component-library-react';
import { MeetingSessionConfiguration } from 'amazon-chime-sdk-js';
import { FC, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CallSideCard } from 'src/telemed/components/CallSideCard';
import { LoadingSpinner } from 'src/telemed/components/LoadingSpinner';
import { useAppointmentStore } from 'src/telemed/features/appointments/appointment.store';
import { CustomContainer } from 'src/telemed/features/common/CustomContainer';
import { useIntakeCommonStore } from 'src/telemed/features/common/intake-common.store';
import { useCallSettingsStore } from 'src/telemed/features/video-call/call-settings.store';
import { useJoinCall } from 'src/telemed/features/video-call/video-call.queries';
import { useVideoCallStore } from 'src/telemed/features/video-call/video-call.store';
import { VideoRoom } from 'src/telemed/features/video-call/VideoRoom';
import { useOystehrAPIClient } from 'src/telemed/utils/getOystehrAPI';
import { ThemeProvider } from 'styled-components';
import { getSelectors } from 'utils/lib/store';
import { APIErrorCode } from 'utils/lib/types/errors';
import { intakeFlowPageRoute } from '../../App';
import { useIsMobile } from '../hooks/useIsMobile';
import { getVideoCallAppointmentId } from './video-chat-helpers';

const VideoChatPage: FC = () => {
  const { meetingData } = getSelectors(useVideoCallStore, ['meetingData']);
  const { videoInput, audioInput, audioOutput } = getSelectors(useCallSettingsStore, [
    'videoInput',
    'audioInput',
    'audioOutput',
  ]);
  const meetingManager = useMeetingManager();
  const audioVideo = useAudioVideo();
  const meetingStatus = useMeetingStatus();
  const { isVideoEnabled } = useLocalVideo();
  const { devices: videoInputs, selectedDevice: selectedVideoDevice } = useVideoInputs();
  const { devices: audioInputs, selectedDevice: selectedAudioDevice } = useAudioInputs();
  const isMobile = useIsMobile();

  const apiClient = useOystehrAPIClient();
  const [searchParams] = useSearchParams();
  const urlAppointmentID = getVideoCallAppointmentId(searchParams);
  const navigate = useNavigate();
  const location = useLocation();
  const isRegularParticipant = location.pathname === intakeFlowPageRoute.VideoCall.path;
  const appointmentID = useAppointmentStore((state) => state.appointmentID);

  useEffect(() => {
    if (urlAppointmentID && urlAppointmentID !== appointmentID) {
      useAppointmentStore.setState(() => ({ appointmentID: urlAppointmentID }));
    }
  }, [appointmentID, urlAppointmentID]);

  useEffect(() => {
    const start = async (): Promise<void> => {
      if (!audioVideo || !meetingData) {
        return;
      }

      if (isVideoEnabled) {
        const newVideoInput =
          videoInput && videoInputs.map(({ deviceId }) => deviceId).includes(videoInput)
            ? videoInput
            : selectedVideoDevice;
        if (newVideoInput) {
          await audioVideo.startVideoInput(newVideoInput);
        }
      }

      const newAudioInput =
        audioInput && audioInputs.map(({ deviceId }) => deviceId).includes(audioInput)
          ? audioInput
          : selectedAudioDevice;
      if (newAudioInput) {
        await audioVideo.startAudioInput(newAudioInput);
      }

      if (audioOutput) {
        await audioVideo.chooseAudioOutput(audioOutput);
        const audioElement = document.getElementsByTagName('audio')[0];
        if (audioElement) {
          await audioVideo.bindAudioElement(audioElement);
        }
      }
    };

    void start();
  }, [
    videoInput,
    audioInput,
    audioOutput,
    audioVideo,
    meetingData,
    isVideoEnabled,
    audioInputs,
    selectedAudioDevice,
    videoInputs,
    selectedVideoDevice,
  ]);

  useEffect(() => {
    return () => {
      const stop = async (): Promise<void> => {
        await audioVideo?.stopAudioInput();
        await audioVideo?.stopVideoInput();
      };

      void stop();
    };
  }, [audioVideo]);

  // The provider permanently ends the meeting for all participants (oystehr.telemed.endMeeting),
  // which stops the Chime session remotely. Voluntary leave produces MeetingStatus.Left and is
  // handled by ConfirmEndCallDialog, so only the remote-ended case is handled here.
  useEffect(() => {
    if (meetingStatus !== MeetingStatus.Ended) {
      return;
    }

    const leave = async (): Promise<void> => {
      await meetingManager.meetingSession?.deviceController.destroy().catch((error) => console.error(error));
      await meetingManager.leave().catch((error) => console.error(error));
      useVideoCallStore.setState({ meetingData: null });
      navigate(isRegularParticipant ? intakeFlowPageRoute.CallEnded.path : intakeFlowPageRoute.InvitedCallEnded.path);
    };

    void leave();
  }, [meetingStatus, meetingManager, navigate, isRegularParticipant]);

  useJoinCall(
    apiClient,
    // Invite URLs carry appointment_id in the query string; regular patient navigation uses the persisted store.
    urlAppointmentID ?? appointmentID,
    async (response) => {
      if (!response) {
        return;
      }

      useVideoCallStore.setState({ meetingData: response });

      const meetingSessionConfiguration = new MeetingSessionConfiguration(response.Meeting, response.Attendee);
      const options = {
        deviceLabels: DeviceLabels.AudioAndVideo,
      };

      await meetingManager.join(meetingSessionConfiguration, options);

      await meetingManager.start();
    },
    (error: any) => {
      if (error.code === APIErrorCode.CANNOT_JOIN_CALL_NOT_IN_PROGRESS) {
        useIntakeCommonStore.setState({ error: error.message });
        navigate(intakeFlowPageRoute.Homepage.path);
      } else {
        useIntakeCommonStore.setState({
          error: 'Error trying to start the video call. Please, reload the page in a moment',
        });
      }
    }
  );

  // Keep the loader up for the whole connection and only render the room once Chime is actually connected
  // (Succeeded). Before this, meetingData could already be set (freshly fetched, or stale from a prior call)
  // while the session is still coming up, so gating on "has meetingData" alone dropped straight to a blank
  // dark VideoRoom — which is what looked like "no loader" after "Return to call". Failed/terminal states
  // fall through (handled elsewhere) so we don't spin forever on a hard failure.
  const isMeetingConnected = meetingStatus === MeetingStatus.Succeeded;
  const isMeetingFailed = meetingStatus === MeetingStatus.Failed || meetingStatus === MeetingStatus.TerminalFailure;
  if (!meetingData || (!isMeetingConnected && !isMeetingFailed)) {
    return (
      <CustomContainer useEmptyBody title="">
        <LoadingSpinner transparent white />
      </CustomContainer>
    );
  }

  if (isMobile) {
    return <VideoRoom />;
  } else {
    return (
      <CustomContainer useEmptyBody title="">
        <Container maxWidth="xl" sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
          <VideoRoom />
          {isRegularParticipant && <CallSideCard />}
        </Container>
      </CustomContainer>
    );
  }
};

const VideoChatPageContainer: FC = () => {
  return (
    <ThemeProvider theme={lightTheme}>
      <GlobalStyles />
      <MeetingProvider>
        <VideoChatPage />
      </MeetingProvider>
    </ThemeProvider>
  );
};

export default VideoChatPageContainer;
