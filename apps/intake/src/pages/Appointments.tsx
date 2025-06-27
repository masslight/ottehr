import { useAuth0 } from '@auth0/auth0-react';
import {
  Cancel,
  CheckCircle,
  CreateOutlined,
  EditCalendarOutlined,
  EventBusyOutlined,
  InfoOutlined,
  WatchLater,
} from '@mui/icons-material';
import { Box, CircularProgress, Divider, Grid, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VisitType } from 'utils';
import { ottehrApi } from '../api';
import { LinkedButtonWithIcon, PageContainer } from '../components';
import { useIntakeCommonStore } from '../features/common';
import { getLocaleDateTimeString } from '../helpers/dateUtils';
import { useTrackMixpanelEvents } from '../hooks/useTrackMixpanelEvents';
import { useUCZambdaClient, ZambdaClient } from '../hooks/useUCZambdaClient';
import { otherColors, palette } from '../IntakeThemeProvider';
import i18n from '../lib/i18n';
import { Appointment } from '../types';

const Appointments = (): JSX.Element => {
  const [appointments, setAppointments] = useState<Appointment[] | undefined>(undefined);
  const zambdaClient = useUCZambdaClient({ tokenless: false });
  const { t } = useTranslation();

  const { lastUsedLocationPath } = useIntakeCommonStore();
  const { isAuthenticated, isLoading } = useAuth0();

  // Track event in Mixpanel only for authenticated page views since
  // user will immediately be redirected to login if unauthenticated
  // there is no specific appointment/location/visit type associated with this page so
  // we send undefined for visitType, bookingCity, bookingState
  useTrackMixpanelEvents({
    eventName: 'Appointments',
    visitType: undefined,
    loading: isAuthenticated && !isLoading ? false : true,
    bookingCity: undefined,
    bookingState: undefined,
  });

  useEffect(() => {
    async function getAppointments(zambdaClient: ZambdaClient): Promise<void> {
      const res = await ottehrApi.getAppointments(zambdaClient);
      const appointments = res.appointments;
      setAppointments(appointments);
    }
    if (zambdaClient) {
      getAppointments(zambdaClient).catch((error) => {
        console.log(error);
      });
    }
  }, [zambdaClient, isLoading, isAuthenticated]);

  const getAppointmentStartTime = (appointment: Appointment): string => {
    let dt = DateTime.fromISO(appointment.start);
    if (appointment.location?.timezone) {
      dt = dt.setZone(appointment.location.timezone);
    }
    return getLocaleDateTimeString(dt, 'medium', i18n.language);
  };
  return (
    <PageContainer title={t('appointments.title')} description={t('appointments.description')}>
      {appointments ? (
        appointments.length === 0 ? (
          <Typography variant="body1">{t('appointments.noAppts')}</Typography>
        ) : (
          <Box>
            {appointments.map((appointment) => {
              return (
                <Grid
                  key={appointment.id}
                  container
                  sx={{ backgroundColor: otherColors.primaryBackground, borderRadius: 2, padding: 2, marginBottom: 2 }}
                  className="appointment"
                >
                  <Grid item xs={12}>
                    <Typography variant="h3" color="secondary.main" marginBottom={2} className="name">
                      {appointment.firstName} {appointment.middleName} {appointment.lastName}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={8} textAlign={{ xs: 'center', md: 'start' }}>
                    <Typography variant="body2" color="secondary.main" className="date">
                      {getAppointmentStartTime(appointment)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4} textAlign={{ xs: 'center', md: 'end' }}>
                    {appointment.visitType !== VisitType.WalkIn &&
                      appointment.visitType !== VisitType.PostTelemed &&
                      !appointment.checkedIn && (
                        <LinkedButtonWithIcon
                          to={`/visit/${appointment.id}/reschedule`}
                          text={t('appointments.modify')}
                          btnVariant="text"
                          startIcon={<EditCalendarOutlined />}
                          className="modify-button"
                        />
                      )}
                  </Grid>

                  <Grid item xs={12} md={8} textAlign={{ xs: 'center', md: 'start' }}>
                    <Typography variant="body2" color="secondary.main" className="location">
                      {appointment.location?.name}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4} textAlign={{ xs: 'center', md: 'end' }}>
                    {!appointment.checkedIn && appointment.visitType !== VisitType.PostTelemed && (
                      <LinkedButtonWithIcon
                        to={`/visit/${appointment.id}/cancel`}
                        text={t('appointments.cancel')}
                        btnVariant="text"
                        startIcon={<EventBusyOutlined />}
                        className="cancel-button"
                      />
                    )}
                  </Grid>

                  <Grid item xs={12}>
                    <Divider sx={{ marginBottom: 2 }} />
                  </Grid>

                  <Grid
                    item
                    xs={12}
                    md={appointment.paperworkComplete ? 7 : 6}
                    textAlign={{ xs: 'center', md: 'start' }}
                    display="flex"
                    justifyContent="start"
                    className="paperwork"
                  >
                    {appointment.paperworkComplete ? (
                      <>
                        <CheckCircle sx={{ marginRight: 0.5 }} htmlColor={otherColors.darkGreen} />
                        <Typography color={palette.secondary.main} variant="subtitle1">
                          {t('appointments.paperworkComplete')}
                        </Typography>
                      </>
                    ) : (
                      <>
                        <Cancel sx={{ marginRight: 0.5 }} htmlColor={otherColors.cancel} />
                        <Typography color={palette.secondary.main} variant="subtitle1">
                          {t('appointments.paperworkIncomplete')}
                        </Typography>
                      </>
                    )}
                  </Grid>

                  <Grid
                    item
                    xs={12}
                    md={appointment.paperworkComplete ? 5 : 6}
                    textAlign={{ xs: 'center', md: 'end' }}
                    display="flex"
                    justifyContent="end"
                  >
                    <LinkedButtonWithIcon
                      to={`/visit/${appointment.id}`}
                      text={
                        appointment.paperworkComplete ? t('appointments.edit') : t('appointments.completePaperwork')
                      }
                      btnVariant="text"
                      startIcon={<CreateOutlined htmlColor={palette.primary.main} />}
                      className="paperwork-button"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Divider sx={{ marginTop: 1, marginBottom: 2 }} />
                  </Grid>

                  <Grid
                    item
                    xs={12}
                    md={6}
                    textAlign={{ xs: 'center', md: 'start' }}
                    display="flex"
                    justifyContent="start"
                    className="check-in"
                  >
                    {appointment.checkedIn ? (
                      <>
                        <CheckCircle sx={{ marginRight: 0.5 }} htmlColor={otherColors.darkGreen} />
                        <Typography color={palette.secondary.main} variant="subtitle1">
                          {t('appointments.checkedIn')}
                        </Typography>
                      </>
                    ) : (
                      <>
                        <WatchLater sx={{ marginRight: 0.5 }} htmlColor={palette.primary.main} />
                        <Typography
                          data-testid="appointments-check-in-label"
                          color={palette.secondary.main}
                          variant="subtitle1"
                        >
                          {t('appointments.needToCheckIn')}
                        </Typography>
                      </>
                    )}
                  </Grid>

                  <Grid item xs={12} md={6} textAlign={{ xs: 'center', md: 'end' }} display="flex" justifyContent="end">
                    {appointment.checkedIn ? (
                      <>
                        <LinkedButtonWithIcon
                          to={`/visit/${appointment.id}`}
                          text={t('appointments.visitDetails')}
                          btnVariant="text"
                          startIcon={<InfoOutlined />}
                          className="visit-details-button"
                        />
                      </>
                    ) : (
                      <LinkedButtonWithIcon
                        to={`/visit/${appointment.id}/check-in`}
                        text={t('appointments.checkIn')}
                        btnVariant="contained"
                        className="check-in-button"
                      />
                    )}
                  </Grid>
                </Grid>
              );
            })}
            {lastUsedLocationPath && (
              <Grid container>
                <Grid item xs={12}>
                  <LinkedButtonWithIcon
                    to={lastUsedLocationPath}
                    text={t('appointments.registerAnother')}
                    btnVariant="outlined"
                  />
                </Grid>
              </Grid>
            )}
          </Box>
        )
      ) : (
        <CircularProgress />
      )}
    </PageContainer>
  );
};

export default Appointments;
