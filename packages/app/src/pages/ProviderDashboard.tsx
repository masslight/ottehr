import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import { Container, Box, Button, Divider, Typography, useTheme } from '@mui/material';
import { Fragment, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { otherColors } from '../OttehrThemeProvider';
import { OttehrDefaultProvider } from '../assets/icons';
import { Footer, PatientQueue, TopAppBar } from '../components';
import { useAuth0 } from '@auth0/auth0-react';

export const ProviderDashboard = (): JSX.Element => {
  const { isAuthenticated, loginWithRedirect, getAccessTokenSilently } = useAuth0();

  const { t } = useTranslation();

  useEffect(() => {
    const fetchAccessToken = async (): Promise<void> => {
      try {
        if (!isAuthenticated) {
          const token = await getAccessTokenSilently();
          console.log('Access token:', token);
        } else {
          await loginWithRedirect();
        }
      } catch (error) {
        console.error('Error occurred while fetching the access token:', error);
      }
    };
    fetchAccessToken()
      .then(() => {
        console.log('Access token fetched successfully');
      })
      .catch((error) => {
        console.error('Error fetching access token:', error);
      });
  }, [isAuthenticated, getAccessTokenSilently, loginWithRedirect]);

  const theme = useTheme();

  // hard coded patients data for now
  const patientsData = [
    {
      name: 'John Doe',
      queuedTime: '2023-09-29T08:15:00Z',
      roomName: 'testRoom',
    },
    {
      name: 'Jane Smith',
      queuedTime: '2023-09-29T15:54:00Z',
      roomName: 'testRoom',
    },
  ];

  const roomLink = ' https://zapehr.app/oliviasmith';

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
      <Box sx={{ display: 'flex', flexDirection: { md: 'row', xs: 'column' }, flexGrow: 1 }}>
        <Box
          sx={{
            alignItems: 'center',
            backgroundColor: 'transparent',
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            justifyContent: 'flex-start',
            pt: 7.5,
            px: 7.5,
            [theme.breakpoints.down('md')]: {
              flexGrow: 0,
              px: 2,
              py: 4,
            },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { md: 'row', xs: 'column-reverse' },
              justifyContent: 'space-between',
              width: '100%',
              [theme.breakpoints.down('md')]: {
                gap: 1,
              },
            }}
          >
            <Box>
              <Typography color="primary.light" fontWeight={500} variant="h5">
                {t('general.goodMorning')}
              </Typography>

              <Typography color="text.light" mt={1} variant="h4">
                Dr. Olivia Smith
              </Typography>
            </Box>
            <Box sx={{ maxWidth: { md: '100px', xs: '50px' } }}>
              <img alt="Provider Image" src={OttehrDefaultProvider} width={'100%'} />
            </Box>
          </Box>
          <Box
            sx={{
              backgroundColor: otherColors.pattensBlue,
              borderRadius: 1,
              boxSizing: 'border-box',
              margin: 3,
              p: 3,
              [theme.breakpoints.down('md')]: {
                mx: 0,
                my: 2,
                p: 3,
              },
            }}
          >
            <Typography color="text.light" sx={{ overflowWrap: 'break-word' }} variant="body1">
              {t('general.shareLink')}
            </Typography>

            <Typography color="text.light" fontFamily="work Sans" sx={{ overflowWrap: 'break-word' }} variant="h5">
              {roomLink}
            </Typography>

            <Box
              sx={{
                display: 'flex',
                gap: 2,
                justifyContent: 'flex-start',
                marginTop: 2,
              }}
            >
              <Button
                color="primary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(roomLink);
                  } catch (error) {
                    console.error('Failed to copy room link to clipboard:', error);
                  }
                }}
                startIcon={<ContentCopyIcon />}
                variant="contained"
              >
                {t('general.copyLink')}
              </Button>
              <Button color="primary" startIcon={<MailOutlineIcon />} variant="outlined">
                {t('general.sendEmail')}
              </Button>
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            background: 'linear-gradient(21deg, rgba(40, 150, 198, 0.60) 3.6%, rgba(80, 96, 241, 0.00) 40%), #263954',
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            justifyContent: 'flex-start',
            pt: 7.5,
            px: 7.5,
            [theme.breakpoints.down('md')]: {
              px: 2,
              py: 4,
            },
          }}
        >
          <Typography color="primary.light" fontWeight={500} variant="h5">
            {t('general.patientsQueue')}
          </Typography>

          <Typography color="primary.contrast" fontWeight={500} sx={{ opacity: 0.6 }} variant="body2">
            {t('general.waiting')}
          </Typography>

          {patientsData.map((patient, index) => (
            <Fragment key={index}>
              <PatientQueue {...patient} />
              {index !== patientsData.length - 1 && <Divider sx={{ opacity: 0.12 }} />}
            </Fragment>
          ))}
        </Box>
      </Box>
      <Footer />
    </Container>
  );
};
