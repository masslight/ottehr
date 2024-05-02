import { useEffect } from 'react';
import Video, { LocalAudioTrack, LocalVideoTrack, Room } from 'twilio-video';
import { getSelectors } from 'ottehr-utils';
import { CallSideCard, LoadingSpinner, VideoRoom } from '../components';
import { useVideoCallStore } from '../features/video-call';
import { useDevices } from '../hooks';
import { useGetVideoToken } from '../features/video-call';
import { useAuth0 } from '@auth0/auth0-react';
import { IntakeFlowPageRoute } from '../App';
import { CustomContainer } from '../features/common';
import { Container } from '@mui/material';

const VideoChatPage = (): JSX.Element => {
  const hasVideoDevice = useDevices().videoInputDevices.length > 0;
  const videoCallState = getSelectors(useVideoCallStore, ['room', 'localTracks', 'videoToken']);

  const { getAccessTokenSilently } = useAuth0();

  useGetVideoToken(getAccessTokenSilently, (data) => {
    useVideoCallStore.setState({ videoToken: data.token });
  });

  useEffect(() => {
    let ignore = false;
    let connectedRoom: Room | null = null;

    const loadVideo = async (): Promise<void> => {
      if (videoCallState.videoToken) {
        const tracks = await Video.createLocalTracks({
          audio: true,
          video: hasVideoDevice,
        });

        const localTracks = tracks.filter((track) => track.kind === 'audio' || track.kind === 'video') as (
          | LocalAudioTrack
          | LocalVideoTrack
        )[];

        localTracks.forEach((track) => track.disable());

        connectedRoom = await Video.connect(videoCallState.videoToken, {
          audio: true,
          tracks: localTracks,
          video: hasVideoDevice,
        });

        if (!ignore) {
          useVideoCallStore.setState({ localTracks, room: connectedRoom });
        }
      }
    };

    void loadVideo();

    return () => {
      ignore = true;
      if (connectedRoom) {
        connectedRoom.localParticipant.tracks.forEach((trackPub) => {
          if (trackPub.track.kind === 'audio' || trackPub.track.kind === 'video') {
            (trackPub.track as LocalAudioTrack | LocalVideoTrack).stop();
          }
        });
        connectedRoom.disconnect();
      }
    };
  }, [hasVideoDevice, videoCallState.videoToken]);

  if (!videoCallState.room) {
    return (
      <CustomContainer useEmptyBody title="" bgVariant={IntakeFlowPageRoute.VideoCall.path}>
        <LoadingSpinner transparent />
      </CustomContainer>
    );
  }

  return (
    <CustomContainer useEmptyBody title="" bgVariant={IntakeFlowPageRoute.VideoCall.path}>
      <Container maxWidth="xl" sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
        <VideoRoom />
        <CallSideCard />
      </Container>
    </CustomContainer>
  );
};

export default VideoChatPage;
