import CancelIcon from '@mui/icons-material/Cancel';
import CheckIcon from '@mui/icons-material/CheckCircle';
import {
  Box,
  Button,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { useState } from 'react';
import { Footer, ProviderHeaderSection, TopAppBar } from '../components';

export const ProviderSettings = (): JSX.Element => {
  const theme = useTheme();
  const handleSubmit = (event: any): void => {
    event.preventDefault();
    // TODO: form submission structure
  };

  const mockData = ['aykhanahmadli', 'samiromarov'];
  const [roomName, setRoomName] = useState('oliviasmith');

  const isError = mockData.includes(roomName);
  const helperText = isError ? 'This name is already taken, please use another one' : '';

  return (
    <Container
      disableGutters
      maxWidth={false}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '100vh',
      }}
    >
      <TopAppBar />
      <ProviderHeaderSection providerName="Dr. Olivia Smith" title="My profile" isProvider={true} />
      <Box
        sx={{
          alignItems: 'center',
          display: 'flex',
          flex: '1 1 auto',
          flexDirection: 'column',
          p: 5,
        }}
      >
        <Box maxWidth="md" width="100%">
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'start', mx: 12.5 }}>
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
                  label="Room Name (slug)"
                  onChange={(e) => setRoomName(e.target.value)}
                  value={roomName}
                  variant="outlined"
                />
                <Box sx={{ alignItems: 'center', display: 'flex' }}>
                  <Box sx={{ mr: 1 }}>{isError ? <CancelIcon color="error" /> : <CheckIcon color="success" />}</Box>
                  <Typography variant="body2">{`https://zapehr.app/${roomName}`}</Typography>
                </Box>
                <TextField label="Email Address" variant="outlined" />
                <Button
                  type="submit"
                  variant="contained"
                  sx={{
                    backgroundColor: theme.palette.primary.main,
                    color: theme.palette.background.default,
                    py: 1.5,
                    textTransform: 'uppercase',
                    width: '100%',
                  }}
                >
                  Update
                </Button>
              </Box>
            </form>
          </Box>
        </Box>
      </Box>
      <Footer />
    </Container>
  );
};
