import React, { FC, useEffect, useState } from 'react';
import { VideoRoom } from './VideoRoom';
import { useDevices } from '../hooks';
import { getSelectors } from '../../shared/store/getSelectors';
import { useVideoCallStore } from '../state';
import Video, { LocalAudioTrack, LocalVideoTrack, Participant, Room } from 'twilio-video';
import { Card, Container } from '@mui/material';

export const VideoChatContainer: FC = () => {
  const hasVideoDevice = useDevices().videoInputDevices.length > 0;
  const videoCallState = getSelectors(useVideoCallStore, ['room', 'localTracks', 'videoToken']);

  const [participants, setParticipants] = useState<Participant[]>([]);

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
            trackPub.track.stop();
            trackPub.track.disable();
            trackPub.track.detach().forEach((element) => element.remove());
            trackPub.unpublish();
          }
        });
        connectedRoom.disconnect();
      }
    };
  }, [hasVideoDevice, videoCallState.videoToken]);

  return (
    <Container sx={{ mt: 3 }}>
      <Card sx={{ backgroundColor: '#1A093B', borderRadius: '8px' }}>
        <VideoRoom participants={participants} setParticipants={setParticipants} />
      </Card>
    </Container>
  );
};
