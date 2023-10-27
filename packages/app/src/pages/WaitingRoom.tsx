import { Box, Typography, useTheme } from '@mui/material';

import { Footer, ProviderHeaderSection, VideoControls } from '../components';
import { useVideoParticipant } from '../store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocalVideo } from '../hooks/twilio/useLocalVideo';
import { otherColors, otherStyling, otherStyling } from '../OttehrThemeProvider';

export const WaitingRoom = (): JSX.Element => {
  const { room, localTracks } = useVideoParticipant();
  const theme = useTheme();
  const videoRef = useRef<HTMLDivElement | null>(null);
  useLocalVideo(videoRef, localTracks);
  const navigate = useNavigate();

  // localParticipant is not counted so we start with 1
  const [numParticipants, setNumParticipants] = useState<number>(1);

  const participantConnected = useCallback(() => {
    setNumParticipants((prevNumParticipants: number) => prevNumParticipants + 1);
  }, []);

  const participantDisconnected = useCallback(() => {
    setNumParticipants((prevNumParticipants: number) => prevNumParticipants - 1);
  }, []);

  useEffect(() => {
    if (room) {
      room.on('participantConnected', participantConnected);
      room.on('participantDisconnected', participantDisconnected);
      room.participants.forEach(participantConnected);
    }
  }, [room, participantConnected, participantDisconnected]);

  // navigate to video call when provider joins
  useEffect(() => {
    console.log('numParticipants', numParticipants);
    if (numParticipants > 1) {
      navigate(`/video-call/`);
    }
    return undefined;
  }, [navigate, numParticipants]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        justifyContent: 'space-between',
      }}
    >
      <ProviderHeaderSection isProvider={true} providerName="Dr. Smith" title="Waiting Room" />
      {/* Middle Section */}
      <Box
        sx={{
          display: 'flex',
          flexGrow: '1',
          justifyContent: 'center',
        }}
      >
        <Box
          maxWidth="md"
          sx={{
            [theme.breakpoints.down('sm')]: {
              px: 2,
            },
          }}
          width="100%"
        >
          <Box
            sx={{
              ...otherStyling.boxPadding,
              [theme.breakpoints.down('sm')]: {
                ...otherStyling.boxPaddingMobile,
              },
            }}
          >
            <Typography sx={{ pb: 1 }} variant="h5">
              Your call will start soon
            </Typography>

            <Box
              sx={{
                alignItems: 'center',
                backgroundColor: 'rgba(50, 63, 83, 0.87)',
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                minHeight: '20vh',
                overflow: 'hidden',
                position: 'relative',
                px: 15,
                py: 10,
              }}
            >
              <Box
                sx={{
                  backgroundColor: otherColors.biscay,
                  borderRadius: 5,
                  bottom: 16,
                  display: 'flex',
                  gap: 1,
                  justifyContent: 'center',
                  left: '50%',
                  maxWidth: 'fit-content',
                  position: 'absolute',
                  transform: 'translate(-50%, 0)',
                  zIndex: 2,
                }}
              >
                <VideoControls inCallRoom={false} localParticipant={room?.localParticipant} />
              </Box>
              <Box
                ref={videoRef}
                sx={{
                  height: '100%',
                  left: 0,
                  position: 'absolute',
                  top: 0,
                  width: '100%',
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
