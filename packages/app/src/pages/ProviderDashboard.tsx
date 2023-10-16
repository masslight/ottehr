import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import { Container, Box, Button, Divider, Grid, Typography } from '@mui/material';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { otherColors } from '../OttEHRThemeProvider';
import { ottEHRDefaultProvider } from '../assets/icons';
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
      <Box sx={{ display: 'flex', flexDirection: 'row', flexGrow: 1 }}>
        <Box
          sx={{
            alignItems: 'center',
            backgroundColor: otherColors.transparent,
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            justifyContent: 'flex-start',
            pl: 10,
            pr: 10,
            pt: 10,
            width: '60%',
          }}
        >
          <Grid container>
            <Grid item xs={6}>
              <Typography color="primary.light" fontWeight={500} variant="h5">
                {t('general.goodMorning')}
              </Typography>

              <Typography color="text.light" mt={1} variant="h4">
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
              <img alt="Provider Image" src={ottEHRDefaultProvider} width="100px" />
            </Grid>
          </Grid>
          <Box
            sx={{
              backgroundColor: otherColors.pattensBlue,
              borderRadius: 1,
              boxSizing: 'border-box',
              margin: 3,
              p: 3,
              width: '100%',
            }}
          >
            <Typography color="text.light" variant="body1">
              {t('general.shareLink')}
            </Typography>

            <Typography color="text.light" fontFamily="work Sans" variant="h5">
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
            background: otherColors.dashboardGradient,
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            justifyContent: 'flex-start',
            pl: 10,
            pr: 10,
            pt: 10,
            width: '40%',
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
