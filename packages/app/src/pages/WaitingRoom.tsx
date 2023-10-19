/* eslint-disable @typescript-eslint/no-unused-vars */
import { Box, Typography, useTheme } from '@mui/material';
import { Participant } from 'twilio-video';

import { Footer, ProviderHeaderSection, VideoControls, VideoParticipant } from '../components';
import { useVideoParticipant } from '../store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocalVideo } from '../hooks/twilio/useLocalVideo';

export const WaitingRoom = (): JSX.Element => {
  const { room, localTracks } = useVideoParticipant();
  const theme = useTheme();

  const navigate = useNavigate();

  // localParticipant is not counted so we start with 1
  const [numParticipants, setNumParticipants] = useState<number>(1);

  const participantConnected = useCallback((participant: Participant) => {
    setNumParticipants((prevNumParticipants: number) => prevNumParticipants + 1);
  }, []);

  const participantDisconnected = useCallback((participant: Participant) => {
    setNumParticipants((prevNumParticipants: number) => prevNumParticipants - 1);
  }, []);

  useEffect(() => {
    if (room) {
      console.log('room', room);
      room.on('participantConnected', participantConnected);
      room.on('participantDisconnected', participantDisconnected);
      room.participants.forEach(participantConnected);
    }
  }, [room, participantConnected, participantDisconnected]);

  useEffect(() => {
    console.log('numParticipants', numParticipants);
    if (numParticipants > 1) {
      navigate(`/video-call/`);
    }
    return undefined;
  }, [navigate, numParticipants]);

  useEffect(() => {
    console.log('room', room);
  }, [room]);

  const videoRef = useRef<HTMLDivElement | null>(null);
  useLocalVideo(videoRef, localTracks);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'space-between' }}>
      <ProviderHeaderSection providerName="Dr.Smith" title="Waiting Room" />
      <Box sx={{ display: 'flex', justifyContent: 'center', flexGrow: '1' }}>
        <Box maxWidth="md" width="100%">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, px: 12.5, py: 7.5 }}>
            <Typography variant="h5">Your call will start soon</Typography>
            <Typography variant="body1">
              Thank you for your patience. Please wait for Dr. Smith to accept your call
            </Typography>

            <Box
              sx={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 2,
                backgroundColor: 'rgba(50, 63, 83, 0.87)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                px: 15,
                py: 10,
                minHeight: '20vh',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 16,
                  left: '50%',
                  transform: 'translate(-50%, 0)',
                  zIndex: 2,
                }}
              >
                <VideoControls localParticipant={room?.localParticipant} inCallRoom={false} />
              </Box>
              <Box
                ref={videoRef}
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                }}
              ></Box>
            </Box>
          </Box>
        </Box>
      </Box>
      <Footer />
    </Box>
  );
};
