import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Checkbox,
  FormControlLabel,
  Button,
  useTheme,
} from '@mui/material';

import MicIcon from '@mui/icons-material/Mic';
import ChatIcon from '@mui/icons-material/Chat';
import CallEndIcon from '@mui/icons-material/CallEnd';
import VideocamIcon from '@mui/icons-material/Videocam';

import Patient from '../assets/icons/ottehrPatientIcon.svg';
import Doctor from '../assets/icons/ottehrProviderIcon.svg';
import CheckIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EllipseDark from '../assets/icons/Ellipse 4.svg';
import EllipseLight from '../assets/icons/Ellipse 5.svg';
import RegistrationLogo from '../assets/icons/ottehrRegistrationLogo.svg';
import { Logo } from '../components/Logo';

const ProviderRegistration = (): JSX.Element => {
  const handleSubmit = (event: any): void => {
    event.preventDefault();
    // TODO: form submission structure
  };

  const theme = useTheme();

  const [roomName, setRoomName] = useState('');
  const mockData = ['aykhanahmadli', 'samiromarov'];

  const isError = mockData.includes(roomName);
  const helperText = isError ? 'This name is already taken, please use another one' : '';

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
      {/* left side */}
      <Box
        sx={{
          width: '55%',
          backgroundColor: '#263954',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 2,
          [theme.breakpoints.down('md')]: {
            py: 2,
            width: '100%',
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Box component="img" src={RegistrationLogo} />
        </Box>
        <Box>
          <Typography variant="body1" color="primary.light" sx={{ textAlign: 'center', py: 2 }}>
            Connect with patients virtually
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            py: 10,
            [theme.breakpoints.down('md')]: {
              flexDirection: 'row',
              py: 0,
              gap: 2,
            },
          }}
        >
          <Box
            component="img"
            src={EllipseDark}
            sx={{
              position: 'absolute',
              mb: 25,
              mr: 18,
              [theme.breakpoints.down('md')]: {
                maxWidth: '60%',
                maxHeight: '60%',
                mb: 0,
              },
            }}
          />
          <Box
            component="img"
            src={EllipseLight}
            sx={{
              position: 'absolute',
              ml: 25,
              [theme.breakpoints.down('md')]: {
                maxWidth: '60%',
                maxHeight: '60%',
                ml: 18,
              },
            }}
          />
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'hidden',
              position: 'absolute',
              mb: 46,
              marginLeft: 36,
              [theme.breakpoints.down('md')]: {
                position: 'static',
                mb: 0,
                ml: 0,
              },
              zIndex: '2',
            }}
          >
            <Box component="img" src={Patient} />
          </Box>

          <Box
            component="img"
            src={Doctor}
            sx={{
              display: 'flex',
              justifyContent: 'center',
              overflow: 'hidden',
              zIndex: '1',
              [theme.breakpoints.down('md')]: {
                maxWidth: '120px',
                maxHeight: '120px',
                borderRadius: 7,
                border: '0.25 solid #fff',
              },
            }}
          />

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              borderRadius: 5,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              zIndex: '1',
              gap: 2.5,
              py: 1.75,
              px: 9,
              [theme.breakpoints.down('md')]: {
                display: 'none',
              },
            }}
          >
            <VideocamIcon style={{ color: 'white' }} />
            <MicIcon style={{ color: 'white' }} />
            <ChatIcon style={{ color: 'white' }} />
            <CallEndIcon style={{ color: 'white' }} />
          </Box>
        </Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Typography component="span" variant="subtitle2" color="primary.light">
            Powered by
          </Typography>
          <Logo width={100} />
        </Box>
      </Box>
      {/* right side */}
      <Box
        sx={{
          width: '45%',
          height: '100vh',
          backgroundColor: 'white',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          [theme.breakpoints.down('md')]: {
            width: '100%',
            height: '100%',
          },
        }}
      >
        <Box sx={{ mx: { xs: 2, md: 12.5 }, my: { xs: 4, md: 10 }, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="h4">Welcome to OttEHR</Typography>
          <Typography variant="h3" color="primary.light" sx={{ pb: 1 }}>
            Provider registration
          </Typography>
          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'left', gap: 2 }}>
              <FormControl variant="outlined">
                <InputLabel>Title</InputLabel>
                <Select label="Title">
                  <MenuItem value="dr">Dr.</MenuItem>
                  <MenuItem value="nurse">Nurse</MenuItem>
                  <MenuItem value="assistant">Assistant</MenuItem>
                </Select>
              </FormControl>
              <TextField variant="outlined" label="First Name" />
              <TextField variant="outlined" label="Last Name" />
              <TextField
                variant="outlined"
                label="Room Name"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                error={isError}
                helperText={helperText}
              />
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box sx={{ mr: 1 }}>{isError ? <CancelIcon color="error" /> : <CheckIcon color="success" />}</Box>
                <Typography variant="body2">{`https://zapehr.app/${roomName}`}</Typography>
              </Box>
              <TextField variant="outlined" label="Email Address" />
              <TextField variant="outlined" label="Password" type="password" />
              <FormControlLabel control={<Checkbox />} label="I am not a patient" />
              <FormControlLabel control={<Checkbox />} label="I accept the terms and conditions" />
              <Button
                type="submit"
                variant="contained"
                sx={{
                  color: 'white',
                  textTransform: 'uppercase',
                  borderRadius: 1,
                  py: 1,
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
