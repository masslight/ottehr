import { Button, TextField, Typography } from '@mui/material';
import { Box } from '@mui/system';
import Footer from '../components/Footer';
import ProviderHeaderSection from '../components/ProviderHeaderSection';

const PatientCheckIn = (): JSX.Element => {
  const handleSubmit = (event: any): void => {
    event.preventDefault();
    // TODO: form submission structure
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'space-between' }}>
      <ProviderHeaderSection providerName="Dr.Smith" title="Waiting Room" />
      {/* Middle Section */}
      <Box sx={{ display: 'flex', justifyContent: 'center', flexGrow: '1' }}>
        <Box maxWidth="md" width="100%">
          <Box sx={{ px: 12.5, py: 7.5 }}>
            <Typography variant="h5" sx={{ pb: 1 }}>
              Check in
            </Typography>
            <Typography variant="body1" sx={{ pb: 3 }}>
              Please enter your name to join the call line of Dr. Olivia Smith
            </Typography>
            <form onSubmit={handleSubmit}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'left' }}>
                <TextField variant="outlined" label="Your Name" sx={{ pb: 2 }} />
                <Button
                  type="submit"
                  variant="contained"
                  sx={{
                    color: 'white',
                    textTransform: 'uppercase',
                    borderRadius: '4px',
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

export default PatientCheckIn;
