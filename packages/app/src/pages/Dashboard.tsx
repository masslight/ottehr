import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import { Box, Button, Container, Divider, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { otherColors } from '../OttehrThemeProvider';
import { defaultProvider } from '../assets/icons';
import { Footer, PatientQueue, TopAppBar } from '../components';
import { createProviderName } from '../helpers';
import { getPatients, getProvider } from '../helpers/mockData';

export const Dashboard = (): JSX.Element => {
  const theme = useTheme();
  const { t } = useTranslation();

  // TODO hard-coded data
  const patients = getPatients();
  const provider = getProvider();

  const hour = DateTime.now().get('hour');

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
                {hour >= 17
                  ? t('dashboard.greetingEvening')
                  : hour >= 12
                  ? t('dashboard.greetingAfternoon')
                  : t('dashboard.greetingMorning')}
              </Typography>

              <Typography color="text.light" mt={1} variant="h4">
                {createProviderName(provider)}
              </Typography>
            </Box>
            <Box sx={{ maxWidth: { md: '100px', xs: '50px' } }}>
              <img alt={t('imageAlts.provider')} src={defaultProvider} width={'100%'} />
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
              {t('dashboard.shareLink')}
            </Typography>

            <Typography color="text.light" sx={{ overflowWrap: 'break-word' }} variant="h5">
              https://zapehr.app/{provider.slug}
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
                    await navigator.clipboard.writeText(`https://zapehr.app/${provider.slug}`);
                  } catch (error) {
                    console.error('Failed to copy room link to clipboard:', error);
                  }
                }}
                startIcon={<ContentCopyIcon />}
                variant="contained"
              >
                {t('dashboard.copyLink')}
              </Button>
              <Button color="primary" startIcon={<MailOutlineIcon />} variant="outlined">
                {t('dashboard.sendEmail')}
              </Button>
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            background: otherColors.dashboardGradient,
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
            {t('dashboard.patientQueue')}
          </Typography>

          <Typography color="primary.contrast" fontWeight={500} mb={2} sx={{ opacity: 0.6 }} variant="body2">
            {t('dashboard.waiting')}
          </Typography>

          {patients.map((patient, index) => (
            <Fragment key={index}>
              <PatientQueue {...patient} />
              {index !== patients.length - 1 && <Divider sx={{ opacity: 0.12 }} />}
            </Fragment>
          ))}
        </Box>
      </Box>
      <Footer />
    </Container>
  );
};
