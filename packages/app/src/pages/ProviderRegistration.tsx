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
import {
  backgroundEllipseDark,
  backgroundEllipseLight,
  ottEHRPatientIcon,
  ottEHRProviderIcon,
  ottEHRRegistrationLogo,
} from '../assets/icons';
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
    <Box sx={{ display: 'flex', flexDirection: { md: 'row', xs: 'column' } }}>
      {/* left side */}
      <Box
        sx={{
          backgroundColor: otherColors.darkBackgroundPaper,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          justifyContent: 'center',
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
          <Typography color="primary.light" sx={{ py: 2, textAlign: 'center' }} variant="body1">
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
              gap: 2,
              py: 0,
            },
          }}
        >
          <Box
            component="img"
            src={backgroundEllipseDark}
            sx={{
              mb: 25,
              mr: 18,
              position: 'absolute',
              [theme.breakpoints.down('md')]: {
                maxHeight: '60%',
                maxWidth: '60%',
                mb: 0,
              },
            }}
          />
          <Box
            component="img"
            src={backgroundEllipseLight}
            sx={{
              ml: 25,
              position: 'absolute',
              [theme.breakpoints.down('md')]: {
                maxHeight: '60%',
                maxWidth: '60%',
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
                mb: 0,
                ml: 0,
                position: 'static',
              },
              zIndex: '2',
            }}
          >
            <Box component="img" src={ottEHRPatientIcon} />
          </Box>
          <Box
            sx={{
              backgroundColor: '#D9F3FF',
              border: '5px solid #fff',
              borderRadius: 5,
              display: 'flex',
              justifyContent: 'center',
              mb: 2,
              overflow: 'hidden',
              pt: 4,
              px: 2,
              zIndex: '1',
              [theme.breakpoints.down('md')]: {
                maxHeight: '118px',
                maxWidth: '118px',
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
              backgroundColor: alpha(theme.palette.background.default, 0.2),
              borderRadius: 5,
              display: 'flex',
              gap: 2.5,
              px: 9,
              py: 1.75,
              [theme.breakpoints.down('md')]: {
                display: 'none',
              },
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
          [theme.breakpoints.down('md')]: {
            height: '100%',
            width: '100%',
          },
          width: '45%',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mx: { md: 12.5, xs: 2 }, my: { md: 10, xs: 4 } }}>
          <Typography variant="h4">Welcome to OttEHR</Typography>
          <Typography color="primary.light" sx={{ pb: 1 }} variant="h3">
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
                sx={{
                  borderRadius: 1,
                  color: theme.palette.background.default,
                  py: 1,
                  textTransform: 'uppercase',
                }}
                type="submit"
                variant="contained"
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
