import { Box, Button, Typography, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Footer, ProviderHeaderSection, TopAppBar } from '../components';
import { otherStyling } from '../OttehrThemeProvider';

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
          <ProviderHeaderSection providerName={patientName} title="Call with" isProvider={!isProvider} />
        </Box>
      ) : (
        <ProviderHeaderSection providerName="Dr. Smith" title="Waiting Room" isProvider={isProvider} />
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
          <Box
            sx={{
              ...otherStyling.boxPadding,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              [theme.breakpoints.down('md')]: {
                ...otherStyling.boxPaddingMobile,
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
                  ...otherStyling.buttonPrimary,
                  px: 2,
                  text: 'primary.contrast',
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
