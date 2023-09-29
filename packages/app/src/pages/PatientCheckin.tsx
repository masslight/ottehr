import { Button, TextField, Typography } from '@mui/material';
import { Box } from '@mui/system';
import React from 'react';

import WaitingRoomLogo from '../assets/icons/waitingRoomLogo.png';

const PatientCheckIn = (): JSX.Element => {
  const handleSubmit = (event: any): void => {
    event.preventDefault();
    // TODO: form submission structure
  };
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'space-between' }}>
      {/* Top Section */}
      <Box
        sx={{
          height: '11.3rem',
          background: 'linear-gradient(89deg, rgba(40, 160, 198, 0.60) 5.05%, rgba(80, 96, 241, 0.17) 50.42%), #263954',
        }}
      >
        <Typography
          sx={{
            color: 'white',
            textAlign: 'left',
            fontWeight: 'bold',
            fontSize: '1.25rem',
            paddingTop: '0.7rem',
            paddingLeft: '1.37rem',
            position: 'absolute',
          }}
        >
          NEW LOGO
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', paddingX: '23.12rem', paddingY: '2.5rem' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              paddingX: '6.25rem',
            }}
          >
            <img src={WaitingRoomLogo} style={{ width: '6.25rem', height: '6.25rem' }} />
            <Box sx={{ marginLeft: '1.5rem' }}>
              <Typography sx={{ color: '#4AC0F2', fontSize: '1.5rem', width: '23.5rem' }}>Waiting Room</Typography>
              <Typography sx={{ color: 'white', fontSize: '2.125rem' }}>Dr. Smith</Typography>
            </Box>
          </Box>
        </Box>
      </Box>

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

      {/* Bottom Section */}
      <Box
        sx={{
          height: '2.5rem',
          backgroundColor: '#202A3E',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography
            sx={{
              color: 'white',
              textAlign: 'left',
              fontWeight: 'bold',
              fontSize: '1.25rem',
              paddingLeft: '1.5rem',
              opacity: '0.2',
            }}
          >
            NEW LOGO
          </Typography>
        </Box>
        <Box sx={{ paddingRight: '1.25rem', display: 'flex', alignItems: 'center' }}>
          <Typography component="span" sx={{ color: '#4AC0F2', fontSize: '0.875rem' }}>
            Powered by _
          </Typography>
          <Typography component="span" sx={{ color: 'white', fontWeight: 'bold', fontSize: '1rem' }}>
            zapEHR
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default PatientCheckIn;
