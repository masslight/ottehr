import { Box, Typography, useTheme } from '@mui/material';
import { useState } from 'react';
import Footer from '../components/Footer';
import ProviderHeaderSection from '../components/ProviderHeaderSection';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import SettingsIcon from '@mui/icons-material/Settings';
import { videoCallMock } from '../assets/icons';

const WaitingRoom = (): JSX.Element => {
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [isMicOpen, setIsMicOpen] = useState(false);
  const theme = useTheme();

  const toggleMic = (): void => {
    setIsMicOpen(!isMicOpen);
  };

  const toggleVideo = (): void => {
    setIsVideoOpen(!isVideoOpen);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        justifyContent: 'space-between',
      }}
    >
      <ProviderHeaderSection providerName="Dr.Smith" title="Waiting Room" />
      {/* Middle Section */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          flexGrow: '1',
        }}
      >
        <Box
          maxWidth="md"
          width="100%"
          sx={{
            [theme.breakpoints.down('sm')]: {
              px: 2,
            },
          }}
        >
          <Box
            sx={{
              px: 12.5,
              py: 7.5,
              [theme.breakpoints.down('sm')]: {
                px: 2,
                py: 4,
              },
            }}
          >
            <Typography variant="h5" sx={{ pb: 1 }}>
              Your call will start soon
            </Typography>
            <Typography variant="body1" sx={{ pb: 3 }}>
              Thank you for your patience. Please wait for Dr. Smith to accept your call.
            </Typography>
            <Box sx={{ position: 'relative', backgroundColor: 'text.light', borderRadius: 5, overflow: 'hidden' }}>
              <img
                src={videoCallMock}
                style={{
                  visibility: isVideoOpen ? 'visible' : 'hidden',
                  display: 'block',
                  maxWidth: '100%',
                  height: 'auto',
                }}
              />
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(50, 63, 83, 0.87)',
                  px: 2,
                  py: 1,
                  gap: 1,
                  maxWidth: 'fit-content',
                  borderRadius: 5,
                  position: 'absolute',
                  bottom: 16,
                  left: '50%',
                  transform: 'translate(-50%, 0)',
                }}
              >
                {isVideoOpen ? (
                  <VideocamIcon sx={{ color: 'white' }} onClick={toggleVideo} />
                ) : (
                  <VideocamOffIcon sx={{ color: 'white' }} onClick={toggleVideo} />
                )}
                {isMicOpen ? (
                  <MicIcon sx={{ color: 'white' }} onClick={toggleMic} />
                ) : (
                  <MicOffIcon sx={{ color: 'white' }} onClick={toggleMic} />
                )}
                <SettingsIcon sx={{ color: 'white' }} />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
      <Footer />
    </Box>
  );
};

export default WaitingRoom;
