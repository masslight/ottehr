import { Button, TextField, Typography } from '@mui/material';
import { Box } from '@mui/system';
import React from 'react';
import TopSection from '../components/TopSection';
import Footer from '../components/Footer';

const PatientCheckIn = (): JSX.Element => {
  const handleSubmit = (event: any): void => {
    event.preventDefault();
    // TODO: form submission structure
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
          paddingY: '3.75rem',
          paddingX: '6.25rem',
        }}
      >
        <Box sx={{ width: '31.3rem' }}>
          <Typography sx={{ fontSize: '1.5rem', paddingBottom: '0.5rem' }}>Check in</Typography>
          <Typography sx={{ fontSize: '1rem', paddingBottom: '1.5rem' }}>
            Please enter your name to join the call line of Dr. Olivia Smith
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'left' }}>
              <TextField variant="outlined" label="Your Name" sx={{ width: '31.3rem', paddingBottom: '1rem' }} />

              <Button
                type="submit"
                variant="contained"
                sx={{
                  width: '31.3rem',
                  backgroundColor: '#2896C6',
                  color: 'white',
                  marginTop: '1rem',
                  textTransform: 'uppercase',
                  borderRadius: '4px',
                }}
              >
                Check In
              </Button>
            </Box>
          </form>
        </Box>
      </Box>

      <Footer />
    </Box>
  );
};

export default PatientCheckIn;
