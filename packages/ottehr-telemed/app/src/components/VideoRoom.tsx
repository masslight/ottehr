import { Box } from '@mui/material';
import { Dispatch, FC, SetStateAction, useState, useEffect, useCallback, useRef } from 'react';
import { Participant, Room } from 'twilio-video';
import { Footer, LoadingSpinner, VideoControls, VideoParticipant } from '.';
import { useLocalVideo } from '../hooks';
import { useVideoParticipant } from '../store';

interface RoomProps {
  participants: Participant[];
  room: Room | null;
  setParticipants: Dispatch<SetStateAction<Participant[]>>;
}

export const VideoRoom: FC<RoomProps> = ({ room, participants, setParticipants }) => {
  const localVideoRef = useRef<HTMLDivElement | null>(null);
  const participantsRef = useRef(setParticipants);
  const { localTracks } = useVideoParticipant();
  useLocalVideo(localVideoRef, localTracks);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // localParticipant is not counted so we start with 1
  const [numParticipants, setNumParticipants] = useState<number>(1);

  useEffect(() => {
    participantsRef.current = setParticipants;
  }, [setParticipants]);

  const participantConnected = useCallback((participant: Participant) => {
    participantsRef.current((prevParticipants) => [...prevParticipants, participant]);
    setNumParticipants((prevNumParticipants) => prevNumParticipants + 1);
  }, []);

  const participantDisconnected = useCallback((participant: Participant) => {
    participantsRef.current((prevParticipants) => prevParticipants.filter((p) => p !== participant));
    setNumParticipants((prevNumParticipants) => prevNumParticipants - 1);
  }, []);

  useEffect(() => {
    if (room) {
      room.on('participantConnected', participantConnected);
      room.on('participantDisconnected', participantDisconnected);
      room.participants.forEach(participantConnected);
    }
  }, [room, participantConnected, participantDisconnected]);

  // loading spinner for when the second participant joins
  useEffect(() => {
    if (numParticipants > 1) {
      setIsLoading(true);

      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 1000);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [numParticipants]);

  const remoteParticipants = participants.map((participant) => (
    <VideoParticipant key={participant.sid} participant={participant} />
  ));

  return (
    // for now only speaker view for two participants
    <Box sx={{ height: '100vh', position: 'relative', width: '100vw' }}>
      {isLoading && <LoadingSpinner transparent={true} />}
      <Box key="video-room">
        <Box
          sx={{
            backgroundColor: 'gray',
            height: '100vh',
          }}
        >
          {remoteParticipants}
        </Box>
        {/* local video */}
        <Box
          ref={localVideoRef}
          sx={{
            backgroundColor: 'lightgray',
            height: 135,
            position: 'absolute',
            right: 16,
            top: 16,
            width: 240,
            zIndex: 2,
          }}
        />
        <Box
          sx={{
            bottom: 16,
            left: '50%',
            position: 'absolute',
            transform: 'translate(-50%, 50%)',
            zIndex: 3,
          }}
        >
          <VideoControls inCallRoom={true} localParticipant={room?.localParticipant} />
        </Box>
      </Box>
      <Footer />
    </Box>
  );
};
