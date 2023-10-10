import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import { Container, Box, Button, Divider, Grid, Typography } from '@mui/material';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { ottehrDefaultProvider } from '../assets/icons';
import { Footer, PatientQueue, TopAppBar } from '../components';

export const ProviderDashboard = (): JSX.Element => {
  const { t } = useTranslation();

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
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'row' }}>
        <Box
          sx={{
            width: '60%',
            flexGrow: 1,
            backgroundColor: 'transparent',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            pt: 10,
            pl: 10,
            pr: 10,
          }}
        >
          <Grid container>
            <Grid item xs={6}>
              <Typography variant="h5" color="primary.light" fontWeight={500}>
                {t('general.goodMorning')}
              </Typography>

              <Typography variant="h4" color="text.light" mt={1}>
                Dr. Olivia Smith
              </Typography>
            </Grid>
            <Grid
              item
              xs={6}
              sx={{
                textAlign: 'right',
              }}
            >
              <img src={ottehrDefaultProvider} alt="Provider Image" width="100px" />
            </Grid>
          </Grid>
          <Box
            sx={{
              width: '100%',
              backgroundColor: '#e5f2f8',
              borderRadius: 1,
              margin: 3,
              p: 3,
              boxSizing: 'border-box',
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
            width: '40%',
            flexGrow: 1,
            background: 'linear-gradient(21deg, rgba(40, 150, 198, 0.60) 3.6%, rgba(80, 96, 241, 0.00) 40%), #263954',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            pt: 10,
            pl: 10,
            pr: 10,
          }}
        >
          <Typography variant="h5" color="primary.light" fontWeight={500}>
            {t('general.patientsQueue')}
          </Typography>

          <Typography variant="body2" sx={{ opacity: 0.6 }} color="primary.contrast" fontWeight={500}>
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
