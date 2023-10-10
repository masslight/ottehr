import { Box, Button, Typography, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Footer, ProviderHeaderSection } from '../components';

export const PostCall = (): JSX.Element => {
  const navigate = useNavigate();
  const theme = useTheme();

  const goToDashboard = (): void => {
    navigate('/dashboard');
  };

  // Mock datas to be replaced
  const mockCallDuration = '15:05';
  const isProvider = true;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        justifyContent: 'space-between',
      }}
    >
      <ProviderHeaderSection providerName="Dr. Smith" title="Waiting Room" />
      {/* Middle Section */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          flexGrow: '1',
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
            <Typography variant="body1" mb={2}>
              Duration {mockCallDuration} mins
            </Typography>
            {isProvider && (
              <Button
                onClick={goToDashboard}
                variant="contained"
                sx={{
                  color: 'white',
                  borderRadius: '4px',
                  width: 'fit-content', // Kept the width as 'fit-content'
                  px: 2,
                  text: 'primary.contrast',
                  textTransform: 'uppercase',
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
