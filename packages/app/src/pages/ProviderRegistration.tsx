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
  useTheme,
} from '@mui/material';
import { useState } from 'react';
import { ellipse4, ellipse5, ottEHRPatientIcon, ottEHRProviderIcon, ottEHRRegistrationLogo } from '../assets/icons';
import { ZapEHRLogo } from '../components';

export const ProviderRegistration = (): JSX.Element => {
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
          backgroundColor: '#263954',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 2,
          [theme.breakpoints.down('md')]: {
            py: 2,
            width: '100%',
          },
          width: '55%',
        }}
      >
        <Box
          sx={{
            alignItems: 'center',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Box component="img" src={ottEHRRegistrationLogo} />
        </Box>
        <Box>
          <Typography color="primary.light" variant="body1" sx={{ textAlign: 'center', py: 2 }}>
            Connect with patients virtually
          </Typography>
        </Box>
        <Box
          sx={{
            alignItems: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
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
            src={ellipse4}
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
            src={ellipse5}
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
              alignItems: 'center',
              display: 'flex',
              justifyContent: 'center',
              marginLeft: 36,
              mb: 46,
              overflow: 'hidden',
              position: 'absolute',
              [theme.breakpoints.down('md')]: {
                position: 'static',
                mb: 0,
                ml: 0,
              },
              zIndex: '2',
            }}
          >
            <Box component="img" src={ottEHRPatientIcon} />
          </Box>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              overflow: 'hidden',
              zIndex: '1',
              backgroundColor: '#D9F3FF',
              border: '5px solid #fff',
              borderRadius: 5,
              mb: 2,
              px: 2,
              pt: 4,
              [theme.breakpoints.down('md')]: {
                maxWidth: '118px',
                maxHeight: '118px',
                pt: 1.5,
                px: 1,
              },
            }}
          >
            <Box component="img" src={ottEHRProviderIcon} sx={{ mb: -1 }} />
          </Box>
          <Box
            sx={{
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: 5,
              display: 'flex',
              gap: 2.5,
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
            alignItems: 'center',
            display: 'flex',
            gap: 1,
            justifyContent: 'center',
          }}
        >
          <Typography color="primary.light" component="span" variant="subtitle2">
            Powered by
          </Typography>
          <ZapEHRLogo width={100} />
        </Box>
      </Box>
      {/* right side */}
      <Box
        sx={{
          backgroundColor: 'white',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          justifyContent: 'center',
          [theme.breakpoints.down('md')]: {
            width: '100%',
            height: '100%',
          },
        }}
      >
        <Box sx={{ mx: { xs: 2, md: 12.5 }, my: { xs: 4, md: 10 }, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="h4">Welcome to OttEHR</Typography>
          <Typography color="primary.light" variant="h3" sx={{ pb: 1 }}>
            Provider registration
          </Typography>
          <form onSubmit={handleSubmit}>
            <Box sx={{ alignItems: 'left', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControl variant="outlined">
                <InputLabel>Title</InputLabel>
                <Select label="Title">
                  <MenuItem value="dr">Dr.</MenuItem>
                  <MenuItem value="nurse">Nurse</MenuItem>
                  <MenuItem value="assistant">Assistant</MenuItem>
                </Select>
              </FormControl>
              <TextField label="First Name" variant="outlined" />
              <TextField label="Last Name" variant="outlined" />
              <TextField
                error={isError}
                helperText={helperText}
                label="Room Name"
                onChange={(e) => setRoomName(e.target.value)}
                value={roomName}
                variant="outlined"
              />
              <Box sx={{ alignItems: 'center', display: 'flex' }}>
                <Box sx={{ mr: 1 }}>{isError ? <CancelIcon color="error" /> : <CheckIcon color="success" />}</Box>
                <Typography variant="body2">{`https://zapehr.app/${roomName}`}</Typography>
              </Box>
              <TextField label="Email Address" variant="outlined" />
              <TextField label="Password" type="password" variant="outlined" />
              <FormControlLabel control={<Checkbox />} label="I am not a patient" />
              {/* TODO too much whitespace here? */}
              <FormControlLabel control={<Checkbox />} label="I accept the terms and conditions" />
              <Button
                type="submit"
                variant="contained"
                sx={{
                  borderRadius: 1,
                  color: 'white',
                  textTransform: 'uppercase',
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
