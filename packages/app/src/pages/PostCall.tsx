import { Box, Button, Typography, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { otherStyling } from '../OttehrThemeProvider';
import { Footer, Header, TopAppBar } from '../components';
import { createProviderName } from '../helpers';

export const PostCall = (): JSX.Element => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { t } = useTranslation();

  const goToDashboard = (): void => {
    navigate('/dashboard');
  };

  // TODO hard-coded data
  const mockCallDuration = '15:05';
  const isProvider = true;
  const patient = {
    name: 'John Doe',
    queuedTime: '2023-09-29T08:15:00Z',
    roomName: 'testRoom',
  };
  const provider = {
    checkboxes: true,
    email: 'osmith@provider.com',
    'first name': 'Olivia',
    'last name': 'Smith',
    slug: 'oliviasmith',
    title: 'Dr',
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
      {isProvider ? (
        <Header isProvider={true} providerName={createProviderName(provider, false)} title={t('general.waitingRoom')} />
      ) : (
        <Box>
          <TopAppBar />
          <Header isProvider={false} providerName={createProviderName(patient)} title={t('postCall.callWith')} />
        </Box>
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
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              [theme.breakpoints.down('md')]: {
                ...otherStyling.boxPaddingMobile,
              },
            }}
          >
            <Typography variant="h5">{t('postCall.callEnded')}</Typography>
            <Typography mb={2} variant="body1">
              {t('postCall.durationPrefix')}
              {mockCallDuration}
              {t('postCall.durationSuffix')}
            </Typography>
            {isProvider && (
              <Button
                onClick={goToDashboard}
                sx={{
                  ...otherStyling.buttonPrimary,
                  px: 2,
                  text: 'primary.contrast',
                  width: 'fit-content',
                }}
                variant="contained"
              >
                {t('postCall.goToDashboard')}
              </Button>
            )}
          </Box>
        </Box>
      </Box>
      <Footer />
    </Box>
  );
};
