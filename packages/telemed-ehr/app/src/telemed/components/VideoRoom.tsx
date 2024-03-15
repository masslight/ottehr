import { Box, Typography } from '@mui/material';
import { Dispatch, FC, SetStateAction, useState, useEffect, useCallback, useRef } from 'react';
import { Participant } from 'twilio-video';
import { getSelectors } from '../../shared/store/getSelectors';
import { LoadingSpinner, VideoControls, VideoParticipant } from '../components';
import { useLocalVideo } from '../hooks';
import { useVideoCallStore } from '../state';

interface RoomProps {
  participants: Participant[];
  setParticipants: Dispatch<SetStateAction<Participant[]>>;
}

export const VideoRoom: FC<RoomProps> = ({ participants, setParticipants }) => {
  const videoCallState = getSelectors(useVideoCallStore, ['room', 'localTracks']);

  const localVideoRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  useLocalVideo(localVideoRef, videoCallState.localTracks);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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
        videoCallState.room.off('participantConnected', participantConnected);
        videoCallState.room.off('participantDisconnected', participantDisconnected);
      }
    };
  }, [videoCallState.room, participantConnected, participantDisconnected]);

  const remoteParticipants = participants.map((participant) => (
    <VideoParticipant key={participant.sid} participant={participant} />
  ));

  return (
    <Box>
      {isLoading && <LoadingSpinner transparent={true} />}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ display: 'flex', padding: 1, gap: 1, height: '557px' }}>
          <Box
            sx={{
              backgroundColor: '#301367',
              color: 'white',
              width: '100%',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            {remoteParticipants}
          </Box>
          <Box
            ref={localVideoRef}
            sx={{
              position: 'relative',
              height: 180,
              minWidth: 180,
              borderRadius: '8px',
              overflow: 'hidden',
              color: 'white',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: 34,
                width: '100%',
                backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0))',
                pt: '10px',
                pl: '10px',
              }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: '14px' }}>You</Typography>
            </Box>
          </Box>
        </Box>
        <Box
          sx={{
            backgroundColor: '#301367',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <VideoControls localParticipant={videoCallState.room?.localParticipant} />
        </Box>
      </Box>
    </Box>
  );
};
