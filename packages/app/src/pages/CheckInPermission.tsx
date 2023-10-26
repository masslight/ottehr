import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import { Button, Box, Typography, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { otherColors, otherStyling } from '../OttehrThemeProvider';
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
          p: '0 0',
        },
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
            <Typography variant="h5">Enable your camera and mic</Typography>
            <Typography variant="body1">Please give us access to your camera and mic for a video call</Typography>
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
                variant="body1"
                sx={{
                  opacity: '0.5',
                  textAlign: 'center',
                }}
              >
                Enable camera in your browser
              </Typography>
            </Box>

            <Button onClick={() => toggleCamMic(true)} variant="contained" sx={otherStyling.buttonPrimary}>
              Enable camera and mic
            </Button>
            <Button
              onClick={() => toggleCamMic(false)}
              variant="text"
              sx={{
                color: theme.palette.primary.light,
                cursor: 'pointer',
                mt: 2,
                textAlign: 'center',
                textTransform: 'uppercase',
              }}
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
