import {
  Button,
  TextField,
  Box,
  Container,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
} from '@mui/material';

import { Footer } from '../components';
import TopAppBar from '../components/AppBar';
import ProviderHeaderSection from '../components/ProviderHeaderSection';
import { useState } from 'react';
import CheckIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

const ProviderSettings = (): JSX.Element => {
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
      maxWidth={false}
      disableGutters
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <TopAppBar />
      <ProviderHeaderSection providerName="Dr. Olivia Smith" title="My profile" />

      <Box
        sx={{
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          p: 5,
        }}
      >
        <Box maxWidth="md" width="100%">
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'start', mx: 12.5 }}>
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
                  label="Room Name (slug)"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  error={isError}
                  helperText={helperText}
                />
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ mr: '1' }}>{isError ? <CancelIcon color="error" /> : <CheckIcon color="success" />}</Box>
                  <Typography variant="body2">{`https://zapehr.app/${roomName}`}</Typography>
                </Box>

                <TextField variant="outlined" label="Email Address" />

                <Button
                  type="submit"
                  variant="contained"
                  sx={{
                    width: '100%',
                    backgroundColor: 'primary.main',
                    color: 'white',
                    py: 1.5,
                    textTransform: 'uppercase',
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

export default ProviderSettings;
