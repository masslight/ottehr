import { Box, Button, Typography, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Footer, ProviderHeaderSection, TopAppBar } from '../components';

export const PostCall = (): JSX.Element => {
  const navigate = useNavigate();
  const theme = useTheme();

  const goToDashboard = (): void => {
    navigate('/dashboard');
  };

  // Mock datas to be replaced
  const mockCallDuration = '15:05';
  const isProvider = true;
  const patientName = 'Jack Nickers';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        justifyContent: 'space-between',
      }}
    >
      {isProvider ? (
        <Box>
          <TopAppBar />
          <ProviderHeaderSection providerName={patientName} title="Call with" isProvider={isProvider} />
        </Box>
      ) : (
        <ProviderHeaderSection providerName="Dr. Smith" title="Waiting Room" isProvider={!isProvider} />
      )}

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
          {/* TODO If these sx props are the same, can we extract them to default primary/secondary button components? */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              px: 12.5,
              py: 7.5,
              [theme.breakpoints.down('md')]: {
                px: 2,
                py: 4,
              },
            }}
          >
            <Typography variant="h5">This call has ended</Typography>
            <Typography mb={2} variant="body1">
              Duration {mockCallDuration} mins
            </Typography>
            {isProvider && (
              <Button
                onClick={goToDashboard}
                variant="contained"
                sx={{
                  borderRadius: '4px',
                  color: 'white',
                  px: 2,
                  text: 'primary.contrast',
                  textTransform: 'uppercase',
                  width: 'fit-content', // Kept the width as 'fit-content'
                }}
              >
                Go to dashboard
              </Button>
            )}
          </Box>
        </Box>
      </Box>
      <Footer />
    </Box>
  );
};
