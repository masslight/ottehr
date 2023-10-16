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
  alpha,
  useTheme,
} from '@mui/material';
import { useState } from 'react';
import { otherColors } from '../OttEHRThemeProvider';
import { ellipse4, ellipse5, ottEHRPatientIcon, ottEHRProviderIcon, ottEHRRegistrationLogo } from '../assets/icons';
import { ZapEHRLogo } from '../components';

export const ProviderRegistration = (): JSX.Element => {
  const theme = useTheme();
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
          backgroundColor: otherColors.darkBackgroundPaper,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 2,
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
          }}
        >
          <Box
            component="img"
            src={ellipse4}
            sx={{
              height: 464,
              mb: 18,
              mr: 18,
              position: 'absolute',
              width: 464,
            }}
          />
          <Box
            component="img"
            src={ellipse5}
            sx={{
              height: 464,
              ml: 18,
              mt: 18,
              width: 464,
              position: 'absolute',
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
              zIndex: '2',
            }}
          >
            <Box component="img" src={ottEHRPatientIcon} />
          </Box>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mb: 2.5,
              overflow: 'hidden',
              zIndex: '1',
            }}
          >
            <img src={ottEHRProviderIcon} />
          </Box>
          <Box
            sx={{
              alignItems: 'center',
              backgroundColor: alpha(theme.palette.background.default, 0.2),
              borderRadius: 5,
              display: 'flex',
              gap: 2.5,
              px: 9,
              py: 1.75,
              zIndex: '1',
            }}
          >
            <VideocamIcon style={{ color: theme.palette.background.default }} />
            <MicIcon style={{ color: theme.palette.background.default }} />
            <ChatIcon style={{ color: theme.palette.background.default }} />
            <CallEndIcon style={{ color: theme.palette.background.default }} />
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
          backgroundColor: theme.palette.background.default,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          justifyContent: 'center',
          width: '45%',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mx: 12.5, my: 10 }}>
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
              <Box>
                <FormControlLabel control={<Checkbox />} label="I am not a patient" />
                <FormControlLabel control={<Checkbox />} label="I accept the terms and conditions" />
              </Box>
              <Button
                type="submit"
                variant="contained"
                sx={{
                  borderRadius: 1,
                  color: theme.palette.background.default,
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
