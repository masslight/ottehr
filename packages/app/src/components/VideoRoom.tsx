/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Video, { Room, Participant } from 'twilio-video';
import { Box, CircularProgress } from '@mui/material';
import { VideoParticipant, VideoControls, LoadingSpinner } from '../components';
import { useVideoParticipant } from '../store';
import { useLocalVideo } from '../hooks/twilio/useLocalVideo';

interface RoomProps {
  room: Room | null;
  handleLogout: () => void;
  participants: Participant[];
  setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>;
}

export const VideoRoom: React.FC<RoomProps> = ({ room, handleLogout, participants, setParticipants }) => {
  const localVideoRef = useRef<HTMLDivElement | null>(null);
  const { localTracks, setLocalTracks } = useVideoParticipant();
  useLocalVideo(localVideoRef, localTracks);

  const [isVideoOpen, setIsVideoOpen] = useState(true);
  const [isMicOpen, setIsMicOpen] = useState(true);

  const participantsRef = useRef(setParticipants);
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
    <Box sx={{ position: 'relative', width: '100vw', height: '100vh' }}>
      {isLoading && <LoadingSpinner />}
      <Box key="video-room">
        <Box
          sx={{
            height: '100vh',
            backgroundColor: 'gray',
          }}
        >
          {remoteParticipants}
        </Box>
        {/* todo: update sx to be more dynamic */}
        <Box
          ref={localVideoRef}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 240,
            height: 135,
            backgroundColor: 'lightgray',
            zIndex: 2,
          }}
        >
          {/* {room?.localParticipant ? (
            <VideoParticipant key={room.localParticipant.sid} participant={room.localParticipant} />
          ) : null} */}
        </Box>
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translate(-50%, 50%)',
            zIndex: 3,
          }}
        >
          <VideoControls
            localParticipant={room?.localParticipant}
            isVideoOpen={isVideoOpen}
            setIsVideoOpen={setIsVideoOpen}
            isMicOpen={isMicOpen}
            setIsMicOpen={setIsMicOpen}
          />
        </Box>
      </Box>
    </Box>
  );
};
