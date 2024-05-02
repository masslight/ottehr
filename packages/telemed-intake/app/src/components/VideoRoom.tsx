import { Box, Typography } from '@mui/material';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { Participant } from 'twilio-video';
import { getSelectors } from 'ottehr-utils';
import { LoadingSpinner, VideoControls, VideoParticipant } from '../components';
import { useVideoCallStore } from '../features/video-call';
import { useLocalVideo } from '../hooks';

export const VideoRoom: FC = () => {
  const videoCallState = getSelectors(useVideoCallStore, ['room', 'localTracks']);

  const localVideoRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLocalVideo(localVideoRef, videoCallState.localTracks);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [participants, setParticipants] = useState<Participant[]>([]);

  // loading spinner for when new participant joins
  const turnLoadingSpinner = useCallback((): void => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setIsLoading(true);

    timerRef.current = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  }, [timerRef, setIsLoading]);

  const participantConnected = useCallback(
    (participant: Participant) => {
      setParticipants([participant]);
      turnLoadingSpinner();
    },
    [setParticipants, turnLoadingSpinner],
  );

  const participantDisconnected = useCallback(
    (participant: Participant) => {
      setParticipants((prevParticipants) => prevParticipants.filter((p) => p !== participant));
    },
    [setParticipants],
  );

  useEffect(() => {
    if (videoCallState.room) {
      videoCallState.room.on('participantConnected', participantConnected);
      videoCallState.room.on('participantDisconnected', participantDisconnected);
      videoCallState.room.participants.forEach(participantConnected);
    }

    return () => {
      if (videoCallState.room) {
        // videoCallState.room.off('participantConnected', participantConnected);
        // videoCallState.room.off('participantDisconnected', participantDisconnected);
      }
    };
  }, [videoCallState.room, participantConnected, participantDisconnected]);

  const remoteParticipants = participants.map((participant) => (
    <VideoParticipant key={participant.sid} participant={participant} />
  ));

  return (
    // for now only speaker view for two participants
    <Box sx={{ position: 'relative', width: '100%' }}>
      {isLoading && <LoadingSpinner transparent />}
      <Box key="video-room" sx={{ display: 'flex', flexDirection: 'column', borderRadius: '8px', overflow: 'hidden' }}>
        <Box
          sx={{
            backgroundColor: '#1A093B',
            height: '600px',
            color: 'white',
          }}
        >
          {remoteParticipants}
        </Box>
        {/* local video */}
        <Box
          ref={localVideoRef}
          sx={{
            position: 'absolute',
            right: 16,
            top: 16,
            width: 150,
            height: 150,
            borderRadius: '8px',
            overflow: 'hidden',
            color: 'white',
            zIndex: 2,
            border: '1px solid #fff',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              display: 'flex',
              alignItems: 'end',
              bottom: 0,
              left: 0,
              height: 34,
              width: '100%',
              backgroundImage: 'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.7))',
              pb: 1,
              pl: 1,
            }}
          >
            <Typography sx={{ fontWeight: 700, fontSize: '14px' }}>You</Typography>
          </Box>
        </Box>

        <Box>
          <VideoControls />
        </Box>
      </Box>
    </Box>
  );
};
