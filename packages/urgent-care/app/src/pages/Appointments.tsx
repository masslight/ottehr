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
import mixpanel from 'mixpanel-browser';
import { useContext, useEffect, useState } from 'react';
import { useZambdaClient } from 'ui-components';
import { VisitType } from 'utils';
import { IntakeFlowPageRoute } from '../App';
import { otherColors, palette } from '../IntakeThemeProvider';
import { zapehrApi } from '../api';
import { CustomContainer, LinkedButtonWithIcon } from '../components';
import { DATETIME_FULL_NO_YEAR } from '../helpers';
import { safelyCaptureException } from '../helpers/sentry';
import { IntakeDataContext } from '../store';
import { updateAppointmentID } from '../store/IntakeActions';

export interface Appointment {
  id: string;
  firstName: string;
  lastName: string;
  start: string;
  location: { name: string; slug: string; timezone: string };
  paperworkComplete: boolean;
  checkedIn: boolean;
  visitType: string;
}

const Appointments = (): JSX.Element => {
  const { state, dispatch } = useContext(IntakeDataContext);
  const [appointments, setAppointments] = useState<Appointment[] | undefined>(undefined);
  const zambdaClient = useZambdaClient({ tokenless: false });

  useEffect(() => {
    mixpanel.track('Appointments');
  }, []);

  useEffect(() => {
    const updateState = (): void => {
      state.appointmentID = undefined;
      state.appointmentSlot = undefined;
      state.patientInfo = undefined;
      state.completedPaperwork = undefined;
    };

    async function getAppointments(): Promise<void> {
      updateState();
      if (zambdaClient) {
        const res = await zapehrApi.getAppointments(zambdaClient, dispatch);
        const appointments = res.appointments;
        setAppointments(appointments);
      }
    }
    getAppointments().catch((error) => {
      console.log(error);
      safelyCaptureException(error);
    });
  }, [dispatch, zambdaClient, state]);

  return (
    <CustomContainer
      title="Reserved check-in times"
      description="Manage your active check-in times here"
      bgVariant={IntakeFlowPageRoute.Appointments.path}
    >
      {appointments ? (
        appointments.length === 0 ? (
          <Typography variant="body1">You don&apos;t have any appointments scheduled.</Typography>
        ) : (
          <Box>
            {appointments.map((appointment) => {
              return (
                <Grid
                  key={appointment.id}
                  container
                  sx={{ backgroundColor: otherColors.primaryBackground, borderRadius: 2, padding: 2, marginBottom: 2 }}
                >
                  <Grid item xs={12}>
                    <Typography variant="h3" color="secondary.main" marginBottom={2}>
                      {appointment.firstName} {appointment.lastName}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={8} textAlign={{ xs: 'center', md: 'start' }}>
                    <Typography variant="body2" color="secondary.main">
                      {DateTime.fromISO(appointment.start)
                        .setZone(appointment.location.timezone)
                        .setLocale('en-us')
                        .toFormat(DATETIME_FULL_NO_YEAR)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4} textAlign={{ xs: 'center', md: 'end' }}>
                    {appointment.visitType !== VisitType.WalkIn && !appointment.checkedIn && (
                      <LinkedButtonWithIcon
                        to={`/appointment/${appointment.id}/reschedule?slug=${appointment.location.slug}`}
                        text="Modify"
                        btnVariant="text"
                        startIcon={<EditCalendarOutlined />}
                        onClickFn={function () {
                          updateAppointmentID(appointment.id, dispatch);
                        }}
                      />
                    )}
                  </Grid>

                  <Grid item xs={12} md={8} textAlign={{ xs: 'center', md: 'start' }}>
                    <Typography variant="body2" color="secondary.main">
                      {appointment.location.name}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4} textAlign={{ xs: 'center', md: 'end' }}>
                    {!appointment.checkedIn && (
                      <LinkedButtonWithIcon
                        to={`/appointment/${appointment.id}/cancel`}
                        text="Cancel"
                        btnVariant="text"
                        startIcon={<EventBusyOutlined />}
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
                  >
                    {appointment.paperworkComplete ? (
                      <>
                        <CheckCircle sx={{ marginRight: 0.5 }} htmlColor={otherColors.darkGreen} />
                        <Typography color={palette.secondary.main} variant="subtitle1">
                          Your paperwork is complete
                        </Typography>
                      </>
                    ) : (
                      <>
                        <Cancel sx={{ marginRight: 0.5 }} htmlColor={otherColors.cancel} />
                        <Typography color={palette.secondary.main} variant="subtitle1">
                          Paperwork incomplete
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
                      to={`/appointment/${appointment.id}`}
                      text={appointment.paperworkComplete ? 'Edit' : 'Complete paperwork'}
                      btnVariant="text"
                      startIcon={<CreateOutlined htmlColor={palette.primary.main} />}
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
                  >
                    {appointment.checkedIn ? (
                      <>
                        <CheckCircle sx={{ marginRight: 0.5 }} htmlColor={otherColors.darkGreen} />
                        <Typography color={palette.secondary.main} variant="subtitle1">
                          You are checked in
                        </Typography>
                      </>
                    ) : (
                      <>
                        <WatchLater sx={{ marginRight: 0.5 }} htmlColor={palette.primary.main} />
                        <Typography color={palette.secondary.main} variant="subtitle1">
                          Check in when you arrive
                        </Typography>
                      </>
                    )}
                  </Grid>

                  <Grid item xs={12} md={6} textAlign={{ xs: 'center', md: 'end' }} display="flex" justifyContent="end">
                    {appointment.checkedIn ? (
                      <>
                        <LinkedButtonWithIcon
                          to={`/appointment/${appointment.id}`}
                          text="Visit details"
                          btnVariant="text"
                          startIcon={<InfoOutlined />}
                        />
                      </>
                    ) : (
                      <LinkedButtonWithIcon
                        to={`/appointment/${appointment.id}/check-in`}
                        text="Check in"
                        btnVariant="contained"
                      />
                    )}
                  </Grid>
                </Grid>
              );
            })}
            {state.selectedLocation?.slug && state.visitType && (
              <Grid container>
                <Grid item xs={12}>
                  <LinkedButtonWithIcon
                    to={`/location/${state.selectedLocation?.slug}/${state.visitType}`}
                    text="Register another patient"
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
    </CustomContainer>
  );
};

export default Appointments;
