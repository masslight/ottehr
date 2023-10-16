import { Button, TextField, Typography, useTheme } from '@mui/material';
import { Box } from '@mui/system';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Footer, ProviderHeaderSection } from '../components';
import { usePatient } from '../store';

export const PatientCheckIn = (): JSX.Element => {
  const { patientName, setPatientName } = usePatient();
  const [name, setName] = useState(patientName);
  const [isError, setIsError] = useState(false);

  const theme = useTheme();
  const navigate = useNavigate();

  const handleSubmit = (event: any): void => {
    event.preventDefault();
    if (name) {
      setPatientName(name);
      navigate('/checkin-permission');
      console.log('hee');
    } else {
      setIsError(true);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        justifyContent: 'space-between',
      }}
    >
      <ProviderHeaderSection providerName="Dr. Smith" title="Waiting Room" isProvider={true} />
      {/* Middle Section */}
      <Box
        sx={{
          display: 'flex',
          flexGrow: '1',
          justifyContent: 'center',
        }}
      >
        <Box
          maxWidth="md"
          width="100%"
          sx={{
            [theme.breakpoints.down('md')]: {
              px: 2,
            },
          }}
        >
          <Box
            sx={{
              px: 12.5,
              py: 7.5,
              [theme.breakpoints.down('md')]: {
                px: 2,
                py: 4,
              },
            }}
          >
            <Typography variant="h5" sx={{ pb: 1 }}>
              Check in
            </Typography>
            <Typography variant="body1" sx={{ pb: 3 }}>
              Please enter your name to join the call line of Dr. Olivia Smith
            </Typography>
            {/* TODO Should we use React hook form? */}
            <form onSubmit={handleSubmit}>
              <Box
                sx={{
                  alignItems: 'flex-start',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <TextField
                  error={isError}
                  label="Your Name"
                  onChange={(e) => setName(e.target.value)}
                  value={name}
                  variant="outlined"
                  sx={{ pb: 2, width: '100%' }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  sx={{
                    borderRadius: '4px',
                    color: 'white',
                    textTransform: 'uppercase',
                    width: '100%',
                  }}
                >
                  Check In
                </Button>
              </Box>
            </form>
          </Box>
        </Box>
      </Box>
      <Footer />
    </Box>
  );
};
