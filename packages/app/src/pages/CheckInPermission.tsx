import { Button, Typography, Box, useTheme } from '@mui/material';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import React from 'react';
import Footer from '../components/Footer';
import ProviderHeaderSection from '../components/ProviderHeaderSection';

const CheckInPermission = (): JSX.Element => {
  const theme = useTheme();
  const enableCamMic = (): void => {
    // TODO: form submission structure
  };

  const continueWithoutCamMic = (): void => {
    // TODO: Logic for continuing without camera and mic
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
              onClick={enableCamMic}
              variant="contained"
              sx={{
                color: 'white',
                borderRadius: '4px',
              }}
            >
              ENABLE CAMERA AND MIC
            </Button>
            <Button
              variant="text"
              sx={{
                color: 'primary.light',
                textAlign: 'center',
                cursor: 'pointer',
                mt: 2,
              }}
              onClick={continueWithoutCamMic}
            >
              CONTINUE WITHOUT CAMERA AND MIC
            </Button>
          </Box>
        </Box>
      </Box>
      <Footer />
    </Box>
  );
};

export default CheckInPermission;
