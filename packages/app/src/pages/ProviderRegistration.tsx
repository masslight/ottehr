import React, { useState } from 'react';
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

import { ReactComponent as DoctorSVG } from '../assets/icons/doctor.svg';
import { ReactComponent as ChatSVG } from '../assets/icons/chat.svg';
import { ReactComponent as CallSVG } from '../assets/icons/call_end.svg';
import { ReactComponent as MicrophoneSVG } from '../assets/icons/keyboard_voice.svg';
import { ReactComponent as VideocamSVG } from '../assets/icons/videocam.svg';
import { ReactComponent as CheckCircleSVG } from '../assets/icons/check_circle.svg';
import { ReactComponent as CancelSVG } from '../assets/icons/cancel.svg';
import { ReactComponent as EllipseDarkSVG } from '../assets/Ellipse 4.svg';
import { ReactComponent as EllipseLightSVG } from '../assets/Ellipse 5.svg';
// import { ReactComponent as PatientSVG } from '../assets/icons/patient.svg';

const ProviderRegistration = (): JSX.Element => {
  const handleSubmit = (event: any): void => {
    event.preventDefault();
    // TODO: form submission structure
  };

  const [roomName, setRoomName] = useState('');
  const mockData = ['aykhanahmadli', 'samiromarov'];

  const isError = mockData.includes(roomName);
  const helperText = isError ? 'This name is already taken, please use another one' : '';

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
          <EllipseDarkSVG
            style={{ width: '29rem', height: '29rem', position: 'absolute', marginBottom: '9rem', marginRight: '9rem' }}
          />
          <EllipseLightSVG
            style={{ width: '29rem', height: '29rem', position: 'absolute', marginTop: '9rem', marginLeft: '9rem' }}
          />
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
              zIndex: '1',
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
              zIndex: '1',
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
      <Box sx={{ width: '45%', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ margin: '4rem 6.25rem', display: 'flex', flexDirection: 'column', height: '54rem' }}>
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
              <TextField
                variant="outlined"
                label="Room Name"
                sx={{
                  width: '26.4rem',
                  paddingBottom: '0.5rem',
                }}
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                error={isError}
                helperText={helperText}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                <Box sx={{ marginRight: '0.5rem' }}>{isError ? <CancelSVG /> : <CheckCircleSVG />}</Box>
                <Typography variant="body2">{`https://zapehr.app/${roomName}`}</Typography>
              </Box>

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
