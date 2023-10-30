import { Button, TextField, Typography, useTheme } from '@mui/material';
import { Box } from '@mui/system';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { otherStyling } from '../OttehrThemeProvider';
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
      <ProviderHeaderSection isProvider={true} providerName="Dr. Smith" title="Waiting Room" />
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
          sx={{
            [theme.breakpoints.down('md')]: {
              px: 2,
            },
          }}
          width="100%"
        >
          <Box
            sx={{
              ...otherStyling.boxPadding,
              [theme.breakpoints.down('md')]: {
                ...otherStyling.boxPaddingMobile,
              },
            }}
          >
            <Typography sx={{ pb: 1 }} variant="h5">
              Check in
            </Typography>
            <Typography sx={{ pb: 3 }} variant="body1">
              Please enter your name to join the call line of Dr. Olivia Smith
            </Typography>
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
                  sx={{ pb: 2, width: '100%' }}
                  value={name}
                  variant="outlined"
                />
                <Button
                  sx={{
                    ...otherStyling.buttonPrimary,
                    width: '100%',
                  }}
                  type="submit"
                  variant="contained"
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
