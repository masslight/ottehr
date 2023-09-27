import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Button from '@mui/material/Button';

import { ReactComponent as DoctorSVG } from '../assets/doctor.svg';
import { ReactComponent as ChatSVG } from '../assets/chat.svg';
import { ReactComponent as CallSVG } from '../assets/call_end.svg';
import { ReactComponent as MicrophoneSVG } from '../assets/keyboard_voice.svg';
import { ReactComponent as VideocamSVG } from '../assets/videocam.svg';
// import { ReactComponent as PatientSVG } from '../assets/patient.svg';

const ProviderRegistration = (): JSX.Element => {
  const handleSubmit = (event: any): void => {
    event.preventDefault();
    // TODO: form submission structure
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', height: '100vh' }}>
      {/* left side */}
      <Box sx={{ width: '55%', backgroundColor: '#263954' }}>
        <Box
          sx={{
            marginTop: '5rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Typography sx={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: '1.5rem' }}>
            NEW LOGO
          </Typography>
        </Box>
        <Box sx={{ marginTop: '1rem' }}>
          <Typography sx={{ color: '#4AC0F2', textAlign: 'center', fontSize: '1rem' }}>
            Connect with patients virtually
          </Typography>
        </Box>
        <Box
          sx={{
            height: '37rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Box
            sx={{
              width: '18.2rem',
              height: '18.2rem',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: '1.25rem',
              backgroundColor: '#D9D9D9',
              overflow: 'hidden',
              border: '0.25rem solid #fff',
              marginBottom: '1.25rem',
            }}
          >
            <DoctorSVG style={{ width: '18.1rem', height: '18.1rem' }} />
            {/* <PatientSVG style={{ width: '18.125rem', height: '18.125rem' }} /> */}
          </Box>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center',
              width: '18.75rem',
              height: '3.375rem',
              borderRadius: '1.25rem',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
            }}
          >
            <ChatSVG />
            <CallSVG />
            <MicrophoneSVG />
            <VideocamSVG />
          </Box>
        </Box>
        <Box
          sx={{
            marginBottom: '4rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Typography component="span" sx={{ color: '#4AC0F2', fontSize: '0.875rem' }}>
            Powered by _
          </Typography>
          <Typography component="span" sx={{ color: 'white', fontWeight: 'bold', fontSize: '1rem' }}>
            zapEHR
          </Typography>
        </Box>
      </Box>

      {/* right side */}
      <Box sx={{ width: '45%', height: '100%', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ margin: '5rem 6.25rem', display: 'flex', flexDirection: 'column' }}>
          <Typography sx={{ fontSize: '2.125rem' }}>Welcome to [app name]</Typography>
          <Typography sx={{ fontSize: '1.25rem', color: '#4AC0F2', paddingTop: '1%', paddingBottom: '1%' }}>
            Provider registration
          </Typography>
          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'left', paddingY: '1.5rem' }}>
              <FormControl variant="outlined" sx={{ width: '26.4rem', marginBottom: '1rem' }}>
                <InputLabel>Title</InputLabel>
                <Select label="Title">
                  <MenuItem value="dr">Dr.</MenuItem>
                  <MenuItem value="nurse">Nurse</MenuItem>
                  <MenuItem value="assistant">Assistant</MenuItem>
                </Select>
              </FormControl>
              <TextField variant="outlined" label="First Name" sx={{ width: '26.4rem', paddingBottom: '1rem' }} />
              <TextField variant="outlined" label="Last Name" sx={{ width: '26.4rem', paddingBottom: '1rem' }} />
              <TextField variant="outlined" label="Room Name" sx={{ width: '26.4rem', paddingBottom: '1rem' }} />
              <TextField variant="outlined" label="Email Address" sx={{ width: '26.4rem', paddingBottom: '1rem' }} />
              <TextField
                variant="outlined"
                label="Password"
                type="password"
                sx={{ width: '26.4rem', paddingBottom: '1rem' }}
              />
              <FormControlLabel control={<Checkbox />} label="I am not a patient" />

              <FormControlLabel control={<Checkbox />} label="I accept the terms and conditions" />
              <Button
                type="submit"
                variant="contained"
                sx={{
                  width: '26.4rem',
                  backgroundColor: '#2896C6',
                  color: 'white',
                  marginTop: '1rem',
                  textTransform: 'uppercase',
                  borderRadius: '4px',
                }}
              >
                Sign Up
              </Button>
            </Box>
          </form>
        </Box>
      </Box>
    </Box>
  );
};

export default ProviderRegistration;
