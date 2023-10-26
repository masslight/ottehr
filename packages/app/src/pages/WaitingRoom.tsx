import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import SettingsIcon from '@mui/icons-material/Settings';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import { Box, Typography, useTheme } from '@mui/material';
import { otherColors, otherStyling } from '../OttehrThemeProvider';
import { videoCallMock } from '../assets/icons';
import { Footer, ProviderHeaderSection } from '../components';
import { usePatient } from '../store';

export const WaitingRoom = (): JSX.Element => {
  const { isVideoOpen, setIsVideoOpen, isMicOpen, setIsMicOpen } = usePatient();
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
      <ProviderHeaderSection providerName="Dr. Smith" title="Waiting Room" isProvider={true} />
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
          width="100%"
          sx={{
            [theme.breakpoints.down('sm')]: {
              px: 2,
            },
          }}
        >
          <Box
            sx={{
              ...otherStyling.boxPadding,
              [theme.breakpoints.down('sm')]: {
                ...otherStyling.boxPaddingMobile,
              },
            }}
          >
            <Typography variant="h5" sx={{ pb: 1 }}>
              Your call will start soon
            </Typography>
            <Typography variant="body1" sx={{ pb: 3 }}>
              Thank you for your patience. Please wait for Dr. Smith to accept your call.
            </Typography>
            <Box sx={{ backgroundColor: 'text.light', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
              <img
                src={videoCallMock}
                style={{
                  display: 'block',
                  visibility: isVideoOpen ? 'visible' : 'hidden',
                }}
              />
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
                  px: 2,
                  py: 1,
                  transform: 'translate(-50%, 0)',
                }}
              >
                {isVideoOpen ? (
                  <VideocamIcon onClick={toggleVideo} sx={{ color: theme.palette.background.default }} />
                ) : (
                  <VideocamOffIcon onClick={toggleVideo} sx={{ color: theme.palette.background.default }} />
                )}
                {isMicOpen ? (
                  <MicIcon onClick={toggleMic} sx={{ color: theme.palette.background.default }} />
                ) : (
                  <MicOffIcon onClick={toggleMic} sx={{ color: theme.palette.background.default }} />
                )}
                <SettingsIcon sx={{ color: theme.palette.background.default }} />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
      <Footer />
    </Box>
  );
};
