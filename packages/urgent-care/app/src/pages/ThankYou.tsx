import { EditCalendarOutlined, EventBusyOutlined } from '@mui/icons-material';
import CreateOutlinedIcon from '@mui/icons-material/CreateOutlined';
import { Button, CircularProgress, Divider, Grid, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import mixpanel from 'mixpanel-browser';
import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useZambdaClient } from 'ui-components';
import { VisitType } from 'utils';
import { IntakeFlowPageRoute } from '../App';
import { otherColors } from '../IntakeThemeProvider';
import zapehrApi from '../api/zapehrApi';
import { ottehrWelcome, clockFullColor } from '../assets/icons';
import { CustomContainer, CardWithDescriptionAndLink } from '../components';
import { DATETIME_FULL_NO_YEAR } from '../helpers';
import { appointmentNotFoundInformation } from '../helpers/information';
import { safelyCaptureException } from '../helpers/sentry';
import { IntakeDataContext } from '../store';
import {
  updateAppointmentID,
  updateAppointmentSlot,
  updateCompletedPaperwork,
  updateFileURLs,
  updatePaperworkQuestions,
  updateSelectedLocation,
} from '../store/IntakeActions';
import { PaperworkResponseWithResponses } from '../types/types';
import { useAuth0 } from '@auth0/auth0-react';

const ThankYou = (): JSX.Element => {
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [paperworkCompleted, setPaperworkCompleted] = useState<boolean>(false);
  const [locationSlug, setLocationSlug] = useState<string | undefined>(undefined);
  const [visitType, setVisitType] = useState<VisitType | undefined>(undefined);
  const [checkedIn, setCheckedIn] = useState<boolean>(false);
  const theme = useTheme();
  const { isAuthenticated, isLoading } = useAuth0();

  const { state, dispatch } = useContext(IntakeDataContext);
  const tokenlessZambdaClient = useZambdaClient({ tokenless: true });
  const tokenfulZambdaClient = useZambdaClient({ tokenless: false });
  const { id: appointmentID } = useParams();

  useEffect(() => {
    mixpanel.track('Thank You');
  }, []);

  useEffect(() => {
    async function updateData(): Promise<void> {
      if (!appointmentID) {
        throw new Error('appointmentID is not defined');
      }

      setLoading(true);
      let paperworkResponse: PaperworkResponseWithResponses | undefined = undefined;
      try {
        if (!isAuthenticated && tokenlessZambdaClient) {
          paperworkResponse = await zapehrApi.getPaperwork(
            tokenlessZambdaClient,
            {
              appointmentID: appointmentID,
            },
            dispatch,
          );
        } else if (tokenfulZambdaClient) {
          paperworkResponse = await zapehrApi.getPaperwork(
            tokenfulZambdaClient,
            {
              appointmentID: appointmentID,
            },
            dispatch,
          );
        }
      } catch (error: any) {
        safelyCaptureException(error);
        if (error.message === 'Appointment is not found') {
          setNotFound(true);
        } else {
          console.log('error', error);
        }
      }

      if (!paperworkResponse) {
        throw new Error('Error loading paperwork information');
      }

      if (paperworkResponse.paperworkCompleteOrInProgress) {
        setPaperworkCompleted(true);
      }

      updateAppointmentID(appointmentID, dispatch);
      updateSelectedLocation(paperworkResponse.appointment.location, dispatch);
      updateAppointmentSlot(paperworkResponse.appointment.start, dispatch);
      updatePaperworkQuestions(paperworkResponse.questions, dispatch);
      updateCompletedPaperwork(paperworkResponse.paperwork, dispatch);
      paperworkResponse.files && updateFileURLs(paperworkResponse.files, dispatch);
      // await prefillPaperworkState(paperworkResponse, VisitType.PreBook, dispatch, appointmentID);
      setLocationSlug(paperworkResponse.appointment.location.slug);
      setVisitType(paperworkResponse.appointment.visitType);
      setCheckedIn(paperworkResponse.appointment.status !== 'booked');
      setLoading(false);
    }

    if (isLoading) {
      setLoading(true);
    } else {
      updateData().catch((error) => {
        safelyCaptureException(error);
        console.log(error);
      });
    }
  }, [appointmentID, dispatch, tokenlessZambdaClient, tokenfulZambdaClient, isAuthenticated, isLoading]);

  const selectedSlotTimezoneAdjusted = useMemo(() => {
    const selectedAppointmentStart = state.appointmentSlot;
    if (selectedAppointmentStart) {
      return DateTime.fromISO(selectedAppointmentStart).setZone(state.selectedLocation?.timezone).setLocale('en-us');
    }

    return undefined;
  }, [state.appointmentSlot, state.selectedLocation?.timezone]);

  // todo reduce code duplication with other files
  const updateState = async (): Promise<void> => {
    state.appointmentID = undefined;
    state.appointmentSlot = undefined;
    state.patientInfo = undefined;
    state.completedPaperwork = undefined;
  };

  if (notFound) {
    return (
      <CustomContainer
        title="Appointment is not found"
        description={appointmentNotFoundInformation}
        bgVariant={IntakeFlowPageRoute.ThankYou.path}
      >
        <></>
      </CustomContainer>
    );
  }

  return (
    <CustomContainer
      title="Thank you for choosing Ottehr Urgent Care"
      description="We look forward to helping you soon!"
      bgVariant={IntakeFlowPageRoute.ThankYou.path}
      outsideCardComponent={
        paperworkCompleted ? (
          <CardWithDescriptionAndLink
            icon={ottehrWelcome}
            iconAlt="Clipboard with pencil icon"
            iconHeight={60}
            mainText={undefined}
            textColor={otherColors.white}
            descText="We need your feedback on this new registration system"
            link="https://ottehr.com"
            linkText="1-minute survey"
            largerLinkTextSpace
            bgColor={otherColors.brightPurple}
          />
        ) : undefined
      }
    >
      {(!loading && (
        <>
          <Divider />
          <Grid container alignItems="center" marginTop={2} marginBottom={2}>
            <Grid item xs={12} md={2.5}>
              <img src={clockFullColor} alt="Clock icon" width="70px" />
            </Grid>
            <Grid item xs={12} md={9.5}>
              <Typography variant="subtitle1" color="text.primary">
                Your check-in time is booked for:
              </Typography>
              <Typography variant="h3" color="primary" mt={0.5}>
                {selectedSlotTimezoneAdjusted?.toFormat(DATETIME_FULL_NO_YEAR)}
              </Typography>
              <Typography variant="body1" color="primary" mt={0.5} sx={{ textDecoration: 'underline' }}>
                {state.selectedLocation ? `${state.selectedLocation?.name}` : 'Unknown'}
              </Typography>
            </Grid>
          </Grid>
          <Divider sx={{ marginBottom: 2 }} />
          {paperworkCompleted && !loading && (
            <Link to={`/paperwork/${state.paperworkQuestions?.[0].slug}`}>
              <Button startIcon={<CreateOutlinedIcon />}>Edit paperwork</Button>
            </Link>
          )}
          {visitType !== VisitType.WalkIn && !checkedIn && (
            <>
              <Link to={`/appointment/${appointmentID}/reschedule?slug=${locationSlug}`}>
                <Button sx={{ marginLeft: 2 }} startIcon={<EditCalendarOutlined />}>
                  Modify
                </Button>
              </Link>
              <Link to="cancel">
                <Button startIcon={<EventBusyOutlined />} sx={{ marginLeft: 2 }}>
                  Cancel
                </Button>
              </Link>
            </>
          )}
          <Typography variant="body2" marginTop={2}>
            You will receive a confirmation email and SMS for your upcoming check-in time shortly. If you need to make
            any changes, please follow the instructions in that message.
          </Typography>
          {!paperworkCompleted && (
            <div
              style={{
                backgroundColor: otherColors.lightBlue,
                padding: 17,
                borderRadius: 8,
                marginTop: 25,
                marginBottom: 25,
              }}
            >
              <Typography variant="body2">
                Please click the &quot;Proceed to paperwork&quot; button below to complete your paperwork prior to your
                visit. If this is not completed in advance, your care may be delayed.
              </Typography>
              <Typography variant="body2" marginTop={2}>
                All patients that present with commercial insurance will be required to leave a credit card on file.
                More details on our financial policy can be found{' '}
                <a
                  style={{ color: theme.palette.primary.main }}
                  target="_blank"
                  href="https://zapehr.com"
                  rel="noreferrer"
                >
                  here
                </a>
                .
              </Typography>
            </div>
          )}
          <Typography variant="body2" marginTop={2}>
            If you have any questions or concerns, please call our team at:{' '}
            {/* TODO: add number instead of placeholder */}
            <strong>Placeholder number</strong>
          </Typography>
          <Grid container alignItems="center" justifyContent="space-between" marginTop={2} marginBottom={2}>
            <Grid item>
              {state.selectedLocation?.slug && state.visitType && (
                <Link to={`/location/${state.selectedLocation?.slug}/${state.visitType}`}>
                  <Button variant="outlined" onClick={updateState}>
                    Register another patient
                  </Button>
                </Link>
              )}
            </Grid>
            {paperworkCompleted || loading ? null : (
              <Grid item>
                <Link
                  to={`/paperwork/${state.paperworkQuestions?.[0].slug}`}
                  state={{
                    pageName: state.paperworkQuestions?.[0].page,
                    items: state.paperworkQuestions?.[0].questions,
                  }}
                >
                  <Button variant="contained">Proceed to paperwork</Button>
                </Link>
              </Grid>
            )}
          </Grid>
        </>
      )) || <CircularProgress />}
    </CustomContainer>
  );
};

export default ThankYou;
