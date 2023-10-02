import { Button, Typography, Box } from '@mui/material';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import React from 'react';
import TopSection from '../components/TopSection';
import Footer from '../components/Footer';

const CheckInPermission = (): JSX.Element => {
  const enableCamMic = (): void => {
    // TODO: form submission structure
  };

  const continueWithoutCamMic = (): void => {
    // TODO: Logic for continuing without camera and mic
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'space-between' }}>
      <TopSection roomName="Waiting Room" />

      {/* Middle Section */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: '#fff',
          height: '35rem',
          py: 7.5,
          px: 12.5,
        }}
      >
        <Box sx={{ width: '31.3rem' }}>
          <Typography sx={{ fontSize: '1.5rem', paddingBottom: '0.5rem' }}>Enable your camera and mic</Typography>
          <Typography sx={{ fontSize: '1rem', paddingBottom: '1.5rem' }}>
            Please give us access to your camera and mic for a video call
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box
            sx={{
              width: '31.25rem',
              height: '14.125rem',
              borderRadius: 2,
              backgroundColor: 'rgba(50, 63, 83, 0.87)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <VideocamOffIcon sx={{ color: '#FFF' }} />
            <Typography
              sx={{
                color: '#FFF',
                fontSize: '16px',
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
              width: '31.3rem',
              backgroundColor: '#2896C6',
              color: 'white',
              borderRadius: '4px',
            }}
          >
            ENABLE CAMERA AND MIC
          </Button>
          <Typography
            sx={{
              textAlign: 'center',
              color: '#2896C6',
              fontSize: '15px',
              cursor: 'pointer',
            }}
            onClick={continueWithoutCamMic}
          >
            CONTINUE WITHOUT CAMERA AND MIC
          </Typography>
        </Box>
      </Box>

      <Footer />
    </Box>
  );
};

export default CheckInPermission;
