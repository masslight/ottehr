/* eslint-disable @typescript-eslint/no-unused-vars */
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import { Box, Container, Divider, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { Fragment, Key, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { otherColors } from '../OttehrThemeProvider';
import { defaultProvider } from '../assets/icons';
import { CustomButton, Footer, LoadingSpinner, PatientQueue, PatientQueueProps, TopAppBar } from '../components';
import { createProviderName, createSlugUrl } from '../helpers';
import { JSX } from 'react/jsx-runtime';
import { usePractitioner, useVideoParticipant } from '../store';
import { useAuth0 } from '@auth0/auth0-react';
import { getPatientQueue } from '../api';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export const Dashboard = (): JSX.Element => {
  const { t } = useTranslation();
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  interface PatientQueueItem {
    encounterId: string;
    patientName: string;
    queuedTime: string;
  }

  const [patients, setPatients] = useState<PatientQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showCheckIcon, setShowCheckIcon] = useState(false);

  const { practitionerProfile, provider } = usePractitioner();
  const providerId = practitionerProfile?.id;
  const theme = useTheme();

  const hour = DateTime.now().get('hour');

  const copySlugToClipboard = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(createSlugUrl(provider?.slug));
      setShowCheckIcon(true);
      setTimeout(() => setShowCheckIcon(false), 2000);
    } catch (error) {
      console.error('Failed to copy room link to clipboard:', error);
    }
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    async function fetchPatientsQueue(): Promise<void> {
      if (!providerId) return;

      const accessToken = await getAccessTokenSilently();
      const response = await getPatientQueue(providerId, accessToken);

      if (response && response.patientsQueue) {
        setPatients(
          response.patientsQueue.map((patient: PatientQueueItem) => ({
            encounterId: patient.encounterId,
            patientName: patient.patientName,
            queuedTime: patient.queuedTime,
          }))
        );
      }
    }
    if (isAuthenticated) {
      fetchPatientsQueue().catch((error) => {
        console.log(error);
      });

      intervalId = setInterval(() => {
        fetchPatientsQueue().catch((error) => {
          console.log(error);
        });
      }, 15000); // auto fetch queue every 15 seconds
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [getAccessTokenSilently, isAuthenticated, providerId]);

  useEffect(() => {
    if (!provider) {
      setIsLoading(true);
    } else if (provider) {
      setIsLoading(false);
    }
  }, [provider]);

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
      {isLoading && <LoadingSpinner transparent={false} />}
      <TopAppBar />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          flexGrow: 1,
          [theme.breakpoints.down('lg')]: {
            flexDirection: 'column',
          },
        }}
      >
        <Box
          sx={{
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
                {provider && createProviderName(provider)}
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
              my: 3,
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
              {provider && createSlugUrl(provider.slug)}
            </Typography>

            <Box
              sx={{
                display: 'flex',
                gap: 2,
                justifyContent: 'flex-start',
                marginTop: 2,
                width: 'fit-content',
              }}
            >
              <CustomButton
                fitContent
                icon={showCheckIcon ? <div></div> : <ContentCopyIcon />}
                onClick={copySlugToClipboard}
              >
                {showCheckIcon ? <CheckCircleIcon /> : t('dashboard.copyLink')}
              </CustomButton>
              <CustomButton fitContent icon={<MailOutlineIcon />} secondary>
                {t('dashboard.sendEmail')}
              </CustomButton>
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

          {patients.map((patient: JSX.IntrinsicAttributes & PatientQueueProps, index: Key | null | undefined) => (
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
