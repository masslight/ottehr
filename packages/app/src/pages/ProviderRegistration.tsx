import CallEndIcon from '@mui/icons-material/CallEnd';
import CancelIcon from '@mui/icons-material/Cancel';
import ChatIcon from '@mui/icons-material/Chat';
import CheckIcon from '@mui/icons-material/CheckCircle';
import MicIcon from '@mui/icons-material/Mic';
import VideocamIcon from '@mui/icons-material/Videocam';
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { ellipse4, ellipse5, ottehrPatientIcon, ottehrProviderIcon, ottehrRegistrationLogo } from '../assets/icons';
import { ZapEHRLogo } from '../components';

export const ProviderRegistration = (): JSX.Element => {
  const handleSubmit = (event: any): void => {
    event.preventDefault();
    // TODO: form submission structure
  };

  const [roomName, setRoomName] = useState('');
  const mockData = ['aykhanahmadli', 'samiromarov'];

  const isError = mockData.includes(roomName);
  const helperText = isError ? 'This name is already taken, please use another one' : '';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'row' }}>
      {/* left side */}
      <Box
        sx={{
          width: '55%',
          backgroundColor: '#263954',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Box component="img" src={ottehrRegistrationLogo} />
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
          }}
        >
          <Box
            component="img"
            src={ellipse4}
            sx={{
              width: 464,
              height: 464,
              position: 'absolute',
              mb: 18,
              mr: 18,
            }}
          />
          <Box
            component="img"
            src={ellipse5}
            sx={{
              width: 464,
              height: 464,
              position: 'absolute',
              mt: 18,
              ml: 18,
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
              zIndex: '2',
            }}
          >
            <Box component="img" src={ottehrPatientIcon} />
          </Box>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              overflow: 'hidden',
              mb: 2.5,
              zIndex: '1',
            }}
          >
            <img src={ottehrProviderIcon} />
          </Box>
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
          <ZapEHRLogo width={100} />
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
        }}
      >
        <Box sx={{ mx: 12.5, my: 10, display: 'flex', flexDirection: 'column', gap: 1 }}>
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
              {/* TODO too much whitespace here? */}
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
