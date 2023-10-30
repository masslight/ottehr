import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import { Box, Button, Typography, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Video, { LocalAudioTrack, LocalVideoTrack } from 'twilio-video';
import { otherColors, otherStyling } from '../OttehrThemeProvider';
import { zapehrApi } from '../api';
import { Footer, ProviderHeaderSection } from '../components';
import { useDevices } from '../hooks';
import { useVideoParticipant } from '../store';

export const VideoSettings = (): JSX.Element => {
  const { setIsMicOpen, setIsVideoOpen, setLocalTracks, setRoom } = useVideoParticipant();
  const theme = useTheme();
  const navigate = useNavigate();

  //TODO: hard coded room name for now, note: twilio free rooms are limited to 2 participant, and it takes around 15-20 seconds to disconnect a participant
  const roomName = 'test1';
  const hasVideoDevice = useDevices().videoInputDevices.length > 0;
  const toggleMicAndCam = async (userInput: boolean): Promise<void> => {
    try {
      setIsMicOpen(userInput);
      setIsVideoOpen(userInput);

      const fetchedToken = await zapehrApi.getTwilioToken(roomName);
      if (fetchedToken === null) {
        console.error('Failed to fetch token');
        return;
      }

      const tracks = await Video.createLocalTracks({
        audio: true,
        video: hasVideoDevice,
      });

      const localTracks = tracks.filter((track) => track.kind === 'audio' || track.kind === 'video') as (
        | LocalAudioTrack
        | LocalVideoTrack
      )[];
      setLocalTracks(localTracks);

      const connectedRoom = await Video.connect(fetchedToken, {
        audio: true,
        name: roomName,
        tracks: localTracks,
        video: hasVideoDevice,
      });

      setRoom(connectedRoom);
      navigate('/waiting-room');
    } catch (error) {
      console.error('An error occurred:', error);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        justifyContent: 'space-between',
        [theme.breakpoints.down('md')]: {
          p: '0 0',
        },
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
        <Box maxWidth="md" width="100%">
          <Box
            sx={{
              ...otherStyling.boxPadding,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              [theme.breakpoints.down('sm')]: {
                ...otherStyling.boxPaddingMobile,
              },
            }}
          >
            <Typography variant="h5">Enable your camera and microphone</Typography>
            <Typography variant="body1">
              Please give us access to your camera and microphone for a video call
            </Typography>
            <Box
              sx={{
                alignItems: 'center',
                backgroundColor: otherColors.biscay,
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                px: 15,
                py: 10,
                [theme.breakpoints.down('md')]: {
                  px: 8,
                  py: 6,
                },
              }}
            >
              <VideocamOffIcon sx={{ color: theme.palette.background.default }} />
              <Typography
                color="primary.contrast"
                sx={{
                  opacity: '0.5',
                  textAlign: 'center',
                }}
                variant="body1"
              >
                Enable camera in your browser
              </Typography>
            </Box>

            <Button onClick={() => toggleMicAndCam(true)} sx={otherStyling.buttonPrimary} variant="contained">
              Enable camera and microphone
            </Button>
            <Button
              onClick={() => toggleMicAndCam(false)}
              sx={{
                color: theme.palette.primary.light,
                cursor: 'pointer',
                mt: 2,
                textAlign: 'center',
                textTransform: 'uppercase',
              }}
              variant="text"
            >
              Continue without camera and microphone
            </Button>
          </Box>
        </Box>
      </Box>
      <Footer />
    </Box>
  );
};
