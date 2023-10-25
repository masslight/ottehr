import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import { Container, Box, Button, Divider, Typography, useTheme } from '@mui/material';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { otherColors } from '../OttEHRThemeProvider';
import { ottEHRDefaultProvider } from '../assets/icons';
import { Footer, PatientQueue, TopAppBar } from '../components';

export const ProviderDashboard = (): JSX.Element => {
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
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
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

              <Typography color="text.light" mt={1} variant="h4">
                Dr. Olivia Smith
              </Typography>
            </Box>
            <Box sx={{ maxWidth: { xs: '50px', md: '100px' } }}>
              <img src={ottEHRDefaultProvider} alt="Provider Image" width={'100%'} />
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
                my: 2,
                mx: 0,
                p: 3,
              },
            }}
          >
            <Typography variant="body1" color="text.light" sx={{ overflowWrap: 'break-word' }}>
              {t('general.shareLink')}
            </Typography>

            <Typography variant="h5" color="text.light" fontFamily="work Sans" sx={{ overflowWrap: 'break-word' }}>
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

          <Typography color="primary.contrast" fontWeight={500} variant="body2" sx={{ opacity: 0.6 }}>
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
