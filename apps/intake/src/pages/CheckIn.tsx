import { CheckCircle } from '@mui/icons-material';
import CancelIcon from '@mui/icons-material/Cancel';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Box, Button, Chip, CircularProgress, Grid, Typography } from '@mui/material';
import { t } from 'i18next';
import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { APIError, APPOINTMENT_NOT_FOUND_ERROR, CheckInZambdaOutput, DATETIME_FULL_NO_YEAR, VisitType } from 'utils';
import ottehrApi from '../api/ottehrApi';
import { PageContainer } from '../components';
import useAppointmentNotFoundInformation from '../helpers/information';
import { useTrackMixpanelEvents } from '../hooks/useTrackMixpanelEvents';
import { useUCZambdaClient } from '../hooks/useUCZambdaClient';
import { otherColors, palette } from '../IntakeThemeProvider';
import i18n from '../lib/i18n';
import { useVisitContext } from './ThankYou';

const CheckIn = (): JSX.Element => {
  const zambdaClient = useUCZambdaClient({ tokenless: true });
  const { id: appointmentID } = useParams();
  const [checkIn, setCheckIn] = useState<CheckInZambdaOutput | undefined>(undefined);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const { appointmentData } = useVisitContext();
  const selectedLocation = useMemo(() => {
    return appointmentData?.appointment?.location;
  }, [appointmentData?.appointment?.location]);

  useTrackMixpanelEvents({
    eventName: 'Check In',
    visitType: checkIn?.visitType,
    loading: !checkIn?.visitType || loading,
    bookingCity: selectedLocation?.address?.city,
    bookingState: selectedLocation?.address?.state,
  });

  useEffect(() => {
    async function updateAppointment(): Promise<void> {
      setLoading(true);
      if (!zambdaClient) {
        throw new Error('zambda client is undefined');
      }
      if (!appointmentID) {
        throw new Error('appointmentID is undefined');
      }
      if (!checkIn) {
        setCheckIn(await ottehrApi.checkIn(zambdaClient, { appointmentId: appointmentID }));
      }
      setLoading(false);
    }

    updateAppointment().catch((error) => {
      if ((error as APIError)?.code === APPOINTMENT_NOT_FOUND_ERROR.code) {
        setNotFound(true);
      } else {
        console.log('error', error);
      }
    });
  }, [zambdaClient, checkIn, appointmentID]);

  const showRegisterAnotherPatient = checkIn?.visitType && checkIn?.visitType !== VisitType.PostTelemed;

  const greenCheckIcon = (
    <Chip
      icon={<CheckCircle />}
      size="small"
      sx={{
        paddingRight: '4px',
        backgroundColor: 'transparent',
        '.MuiChip-icon': { color: otherColors.darkGreen, margin: 0 },
        '.MuiChip-label': { display: 'none' },
      }}
    />
  );

  const redX = (
    <Chip
      icon={<CancelIcon />}
      size="small"
      sx={{
        paddingRight: '4px',
        backgroundColor: 'transparent',
        '.MuiChip-icon': { color: otherColors.cancel, margin: 0 },
        '.MuiChip-label': { display: 'none' },
      }}
    />
  );

  const appointmentNotFoundInformation = useAppointmentNotFoundInformation();

  if (notFound) {
    return (
      <PageContainer title={t('checkIn.notFound')} description={appointmentNotFoundInformation}>
        <></>
      </PageContainer>
    );
  }

  return (
    <PageContainer title={checkIn ? t('checkIn.youAreCheckedIn') : t('checkIn.checkingIn')}>
      {!checkIn ? (
        <CircularProgress />
      ) : (
        <>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <Box
              sx={{
                border: 'none',
                borderRadius: 2,
                backgroundColor: otherColors.primaryBackground,
                padding: 2,
                marginX: 0,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {checkIn.paperworkCompleted ? greenCheckIcon : redX}
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: '16px',
                    color: otherColors.darkPurple,
                  }}
                  variant="body1"
                  className="paperwork"
                >
                  {checkIn.paperworkCompleted ? t('checkIn.yourPaperworkComplete') : t('checkIn.paperworkMissing')}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex' }}>
                <Link
                  to={`/visit/${appointmentID}`}
                  style={{ textDecoration: 'none', display: 'inline-flex' }}
                  className="edit-button"
                >
                  <EditOutlinedIcon sx={{ color: palette.primary.main, width: '18px', height: '18px' }} />
                  <Typography
                    sx={{
                      fontWeight: 700,
                      fontSize: '16px',
                      color: palette.primary.main,
                      marginLeft: '5px',
                    }}
                    variant="body1"
                  >
                    {checkIn.paperworkCompleted ? t('checkIn.edit') : t('checkIn.completePaperwork')}
                  </Typography>
                </Link>
              </Box>
            </Box>
            <Box
              sx={{
                borderRadius: 2,
                backgroundColor: otherColors.primaryBackground,
                padding: 2,
                border: 'none',
                marginX: 0,
                minHeight: 60,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {greenCheckIcon}
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: '16px',
                    color: otherColors.darkPurple,
                  }}
                  variant="body1"
                >
                  {t('appointments.checkedIn')}
                </Typography>
              </Box>
              <Typography variant="body1" color={palette.secondary.main} marginTop={1} className="time">
                {t('checkIn.today')}{' '}
                {DateTime.fromISO(checkIn.start)
                  .setZone(checkIn.location.timezone)
                  .setLocale(i18n.language.split('-')[0] === 'es' ? 'es-US' : 'en-US')
                  .toFormat(DATETIME_FULL_NO_YEAR)}
              </Typography>
              <Typography variant="body1" color={palette.secondary.main} marginTop={1} className="location-name">
                {checkIn.location.name}
              </Typography>
            </Box>
          </Box>
          <Grid container marginTop={2}>
            {showRegisterAnotherPatient && (
              <Grid item xs={12} md={6} textAlign={{ xs: 'center', md: 'start' }} justifyContent="start">
                <Link to={'/home'} className="register-button">
                  <Button variant="outlined">{t('appointments.registerAnother')}</Button>
                </Link>
              </Grid>
            )}
          </Grid>
        </>
      )}
    </PageContainer>
  );
};

export default CheckIn;
