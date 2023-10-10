import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import { Button, Box, Typography, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Footer, ProviderHeaderSection } from '../components';
import { usePatient } from '../store';

export const CheckInPermission = (): JSX.Element => {
  const { setIsVideoOpen, setIsMicOpen } = usePatient();
  const theme = useTheme();
  const navigate = useNavigate();

  const toggleCamMic = (userInput: boolean): void => {
    setIsVideoOpen(userInput);
    setIsMicOpen(userInput);
    navigate('/waiting-room');
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        justifyContent: 'space-between',
        [theme.breakpoints.down('md')]: {
          padding: '0 0',
        },
      }}
    >
      <ProviderHeaderSection providerName="Dr. Smith" title="Waiting Room" />
      {/* Middle Section */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          flexGrow: '1',
        }}
      >
        <Box maxWidth="md" width="100%">
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              px: 12.5,
              py: 7.5,
              [theme.breakpoints.down('sm')]: {
                px: 2,
                py: 4,
              },
            }}
          >
            <Typography variant="h5">Enable your camera and mic</Typography>
            <Typography variant="body1">Please give us access to your camera and mic for a video call</Typography>
            <Box
              sx={{
                borderRadius: 2,
                backgroundColor: 'rgba(50, 63, 83, 0.87)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                px: 15,
                py: 10,
                [theme.breakpoints.down('md')]: {
                  px: 8,
                  py: 6,
                },
              }}
            >
              <VideocamOffIcon sx={{ color: '#FFF' }} />
              <Typography
                variant="body1"
                color="primary.contrast"
                sx={{
                  textAlign: 'center',
                  opacity: '0.5',
                }}
              >
                Enable camera in your browser
              </Typography>
            </Box>

            <Button
              onClick={() => toggleCamMic(true)}
              variant="contained"
              sx={{
                color: 'white',
                borderRadius: '4px',
                textTransform: 'uppercase',
              }}
            >
              Enable camera and mic
            </Button>
            <Button
              variant="text"
              sx={{
                color: 'primary.light',
                textAlign: 'center',
                cursor: 'pointer',
                textTransform: 'uppercase',
                mt: 2,
              }}
              onClick={() => toggleCamMic(false)}
            >
              Continue without camera and mic
            </Button>
          </Box>
        </Box>
      </Box>
      <Footer />
    </Box>
  );
};
