import { Container } from '@mui/material';
import {
  DeviceLabels,
  GlobalStyles,
  MeetingProvider,
  lightTheme,
  useAudioInputs,
  useAudioVideo,
  useLocalVideo,
  useMeetingManager,
  useVideoInputs,
} from 'amazon-chime-sdk-component-library-react';
import { MeetingSessionConfiguration } from 'amazon-chime-sdk-js';
import { FC, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { APIErrorCode, getSelectors } from 'utils';
import { intakeFlowPageRoute } from '../../App';
import { CallSideCard, LoadingSpinner } from '../components';
import { useAppointmentStore } from '../features/appointments';
import { CustomContainer, useIntakeCommonStore } from '../features/common';
import { VideoRoom, useCallSettingsStore, useJoinCall, useVideoCallStore } from '../features/video-call';
import { useZapEHRAPIClient } from '../utils';

const VideoChatPage: FC = () => {
  const { meetingData } = getSelectors(useVideoCallStore, ['meetingData']);
  const { videoInput, audioInput, audioOutput } = getSelectors(useCallSettingsStore, [
    'videoInput',
    'audioInput',
    'audioOutput',
  ]);
  const meetingManager = useMeetingManager();
  const audioVideo = useAudioVideo();
  const { isVideoEnabled } = useLocalVideo();
  const { devices: videoInputs, selectedDevice: selectedVideoDevice } = useVideoInputs();
  const { devices: audioInputs, selectedDevice: selectedAudioDevice } = useAudioInputs();

  const apiClient = useZapEHRAPIClient();
  const [searchParams] = useSearchParams();
  const urlAppointmentID = searchParams.get('appointmentID');
  const navigate = useNavigate();
  const location = useLocation();
  const isRegularParticipant = location.pathname === intakeFlowPageRoute.VideoCall.path;

  if (urlAppointmentID) {
    useAppointmentStore.setState(() => ({ appointmentID: urlAppointmentID }));
  }

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

  useJoinCall(
    apiClient,
    async (response) => {
      useVideoCallStore.setState({ meetingData: response });

      const meetingSessionConfiguration = new MeetingSessionConfiguration(response.Meeting, response.Attendee);
      const options = {
        deviceLabels: DeviceLabels.AudioAndVideo,
      };

      await meetingManager.join(meetingSessionConfiguration, options);

      await meetingManager.start();
    },
    (error) => {
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

  if (!meetingData) {
    return (
      <CustomContainer useEmptyBody title="">
        <LoadingSpinner transparent />
      </CustomContainer>
    );
  }

  return (
    <CustomContainer useEmptyBody title="">
      <Container maxWidth="xl" sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
        <VideoRoom />
        {isRegularParticipant && <CallSideCard />}
      </Container>
    </CustomContainer>
  );
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
