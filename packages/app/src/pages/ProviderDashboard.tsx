import React from 'react';
import { Footer } from '../components';
import { Container, Box, Typography, Button, Divider, useTheme } from '@mui/material';
import defaultProvider from '../assets/icons/ottehrDefaultProvider.svg';
import { useTranslation } from 'react-i18next';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import PatientQueue from '../components/PatientQueue';
import TopAppBar from '../components/AppBar';

const ProviderDashboard = (): JSX.Element => {
  const { t } = useTranslation();

  const theme = useTheme();

  const patientsData = [
    {
      name: 'John Doe',
      queuedTime: '2023-09-29T08:15:00Z',
      link: 'https://example.com/john',
    },
    {
      name: 'Jane Smith',
      queuedTime: '2023-09-29T15:54:00Z',
      link: 'https://example.com/jane',
    },
  ];

  const roomLink = ' https://zapehr.app/oliviasmith';

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
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
        <Box
          sx={{
            width: { xs: '100%', md: '60%' },
            flexGrow: 1,
            backgroundColor: 'transparent',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            pt: 7.5,
            px: 7.5,
            [theme.breakpoints.down('md')]: {
              px: 2,
              py: 4,
              flexGrow: 0,
            },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              width: '100%',
              flexDirection: { xs: 'column-reverse', md: 'row' },
              [theme.breakpoints.down('md')]: {
                gap: 1,
              },
            }}
          >
            <Box>
              <Typography variant="h5" color="primary.light" fontWeight={500}>
                {t('general.goodMorning')}
              </Typography>

              <Typography variant="h4" color="text.light" mt={1}>
                Dr. Olivia Smith
              </Typography>
            </Box>
            <Box sx={{ maxWidth: { xs: '50px', md: '100px' } }}>
              <img src={defaultProvider} alt="Provider Image" width={'100%'} />
            </Box>
          </Box>
          <Box
            sx={{
              width: '100%',
              backgroundColor: '#e5f2f8',
              borderRadius: 1,
              margin: 3,
              p: 3,
              boxSizing: 'border-box',
              [theme.breakpoints.down('md')]: {
                my: 2,
                mx: 0,
                p: 4,
              },
            }}
          >
            <Typography variant="body1" color="text.light">
              {t('general.shareLink')}
            </Typography>

            <Typography variant="h5" color="text.light" fontFamily="work Sans">
              {roomLink}
            </Typography>

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-start',
                gap: 2,
                marginTop: 2,
              }}
            >
              <Button
                variant="contained"
                color="primary"
                startIcon={<ContentCopyIcon />}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(roomLink);
                  } catch (error) {
                    console.error('Failed to copy room link to clipboard:', error);
                  }
                }}
              >
                {t('general.copyLink')}
              </Button>
              <Button variant="outlined" color="primary" startIcon={<MailOutlineIcon />}>
                {t('general.sendEmail')}
              </Button>
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            width: { xs: '100%', md: '40%' },
            flexGrow: 1,
            background: 'linear-gradient(21deg, rgba(40, 150, 198, 0.60) 3.6%, rgba(80, 96, 241, 0.00) 40%), #263954',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            pt: 7.5,
            px: 7.5,
            [theme.breakpoints.down('md')]: {
              px: 2,
              py: 4,
            },
          }}
        >
          <Typography variant="h5" color="primary.light" fontWeight={500}>
            {t('general.patientsQueue')}
          </Typography>

          <Typography variant="body2" sx={{ opacity: 0.6 }} color="primary.contrast" fontWeight={500}>
            {t('general.waiting')}
          </Typography>

          {patientsData.map((patient, index) => (
            <React.Fragment key={index}>
              <PatientQueue {...patient} />
              {index !== patientsData.length - 1 && <Divider sx={{ opacity: 0.12 }} />}
            </React.Fragment>
          ))}
        </Box>
      </Box>
      <Footer />
    </Container>
  );
};

export default ProviderDashboard;
