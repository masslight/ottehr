import { useAuth0 } from '@auth0/auth0-react';
import { Box, CircularProgress, Divider, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import mixpanel from 'mixpanel-browser';
import { useCallback, useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useZambdaClient, PageForm } from 'ottehr-components';
import { IntakeFlowPageRoute } from '../App';
import zapehrApi, { AvailableLocationInformation } from '../api/zapehrApi';
import { ottehrWelcome } from '../assets/icons';
import { CustomContainer, Schedule } from '../components';
import { getAuthedLandingPage } from '../helpers';
import { safelyCaptureException } from '../helpers/sentry';
import { IntakeDataContext } from '../store';
import { updateAppointmentID, updateSelectedLocation } from '../store/IntakeActions';
import { VisitType } from '../store/types';
import { Appointment } from './Appointments';
import { WaitingEstimateCard } from '../components/WaitingEstimateCard';

interface CustomContainerText {
  title: string;
  subtext?: string;
}

const Welcome = (): JSX.Element => {
  const navigate = useNavigate();

  const { state, dispatch } = useContext(IntakeDataContext);
  const tokenlessZambdaClient = useZambdaClient({ tokenless: true });
  const tokenfulZambdaClient = useZambdaClient({ tokenless: false });
  const [searchParams] = useSearchParams();
  const searchParamSlug = searchParams.get('slug');
  const { slug, visit_type: visitType, id: appointmentID } = useParams();
  const locationSlug = (slug || searchParamSlug) ?? undefined;
  const [locationLoading, setLocationLoading] = useState<boolean>(true);
  const [appointmentsLoading, setAppointmentsLoading] = useState<boolean>(true);
  const [slotData, setSlotData] = useState<string[] | undefined>(undefined);
  const [pageNotFound, setPageNotFound] = useState(false);
  const locObj = localStorage.getItem('currLocation');
  const locObjJson = locObj ? (JSON.parse(locObj) as AvailableLocationInformation) : undefined;
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const theme = useTheme();
  const [waitingMinutes, setWaitingMinutes] = useState<number | undefined>(undefined);
  const [officeOpen, setOfficeOpen] = useState<boolean>(false);

  useEffect(() => {
    mixpanel.track('Welcome');
  }, []);

  useEffect(() => {
    if (appointmentID) {
      updateAppointmentID(appointmentID, dispatch);
    }
    if (visitType === VisitType.WalkIn || visitType === VisitType.PreBook) {
      localStorage.setItem('visitType', visitType);
      localStorage.setItem('slug', locationSlug ?? '');
    } else if (!localStorage.getItem('visitType')) {
      setPageNotFound(true);
    }
  }, [locationSlug, navigate, visitType, appointmentID, dispatch]);

  useEffect(() => {
    const fetchLocation = async (): Promise<any> => {
      try {
        if (!tokenlessZambdaClient) {
          return;
        }
        const res = await zapehrApi.getLocation(
          tokenlessZambdaClient,
          {
            locationSlug: locationSlug,
          },
          dispatch,
        );

        const location: AvailableLocationInformation = res?.location;
        setWaitingMinutes(res?.waitingMinutes);

        const available = res.available;
        if (!location) {
          setPageNotFound(true);
          return;
        }

        setLocationLoading(false);
        localStorage.setItem('currLocation', JSON.stringify(location));
        updateSelectedLocation(location, dispatch);
        const sortedDatesArray = available.sort((a: string, b: string) => a.localeCompare(b));
        setSlotData(sortedDatesArray);
      } catch (error) {
        safelyCaptureException(error);
        console.error('Error validating location: ', error);
      }
    };

    // So long as / is a valid path or auth0 redirects to /, this must be here. Otherwise the
    // function is called with no slug parameter and overwrites the contents of local storage.
    if (locationSlug) {
      void fetchLocation();
    } else {
      setPageNotFound(true);
    }
  }, [dispatch, navigate, locationSlug, tokenlessZambdaClient]);

  useEffect(() => {
    const dateNow = DateTime.now();
    const todayShort = dateNow.toLocaleString({ weekday: 'short' }).toLowerCase();
    const hoursForToday = state?.selectedLocation?.hoursOfOperation?.find((item) => {
      return item.daysOfWeek?.[0] === todayShort;
    });

    let isWithinHours = false;
    if (hoursForToday && hoursForToday.openingTime) {
      const openTime = DateTime.fromISO(hoursForToday.openingTime);
      const closeTime = hoursForToday.closingTime ? DateTime.fromISO(hoursForToday.closingTime) : undefined;
      isWithinHours = openTime <= dateNow && (closeTime === undefined || closeTime > dateNow);
    }

    setOfficeOpen(isWithinHours);
  }, [state?.selectedLocation?.hoursOfOperation]);

  const checkInIfAppointmentBooked = useCallback(async () => {
    if (isAuthenticated && tokenfulZambdaClient) {
      const response = await zapehrApi.getAppointments(tokenfulZambdaClient, dispatch);
      const appointments: Appointment[] = response.appointments;
      for (const appointment of appointments) {
        if (visitType === VisitType.WalkIn && !appointment.checkedIn) {
          navigate(`/appointment/${appointment.id}/check-in`);
          break;
        }
      }
      setAppointmentsLoading(false);
    } else {
      setAppointmentsLoading(false);
    }
  }, [dispatch, isAuthenticated, navigate, visitType, tokenfulZambdaClient]);

  useEffect(() => {
    if (visitType === VisitType.WalkIn) {
      setAppointmentsLoading(true);
      checkInIfAppointmentBooked().catch((error) => {
        console.log(error);
        safelyCaptureException(error);
      });
    } else {
      setAppointmentsLoading(false);
    }
  }, [checkInIfAppointmentBooked, visitType]);

  const getCustomContainerText = (): CustomContainerText => {
    if (state.appointmentID) {
      return { title: 'Modify check-in time', subtext: 'Please select a new check-in time.' };
    } else if (visitType === VisitType.PreBook) {
      return { title: 'Welcome to Ottehr' };
    } else {
      return { title: 'Welcome to Ottehr Urgent Care', subtext: 'We look forward to helping you soon!' };
    }
  };

  const { title, subtext } = getCustomContainerText();

  if (pageNotFound) {
    return (
      <CustomContainer title="Not Found" bgVariant={IntakeFlowPageRoute.Welcome.path}>
        <Typography variant="body1">
          You have navigated to a page that is not found. To find an Ottehr location,{' '}
          <Link to="https://ottehr.com">please visit our website</Link>.
        </Typography>
      </CustomContainer>
    );
  }

  const bgVariant =
    visitType === VisitType.WalkIn ? IntakeFlowPageRoute.Welcome.path : IntakeFlowPageRoute.WelcomeType.path;

  return (
    <CustomContainer
      title={title}
      subtitle={appointmentsLoading || locationLoading ? 'Loading...' : `${locObjJson?.name}`}
      subtext={appointmentsLoading || locationLoading ? '' : subtext}
      isFirstPage
      img={ottehrWelcome}
      imgAlt="Ottehr Icon"
      imgWidth={90}
      bgVariant={bgVariant}
      outsideCardComponent={
        visitType === VisitType.PreBook && officeOpen ? (
          <WaitingEstimateCard waitingMinutes={waitingMinutes} />
        ) : undefined
      }
    >
      {visitType === VisitType.PreBook && (
        <>
          <Box>
            <Typography variant="body1">We look forward to helping you very soon!</Typography>
            <Typography variant="body1" sx={{ marginTop: 2 }}>
              Don&apos;t see an option you want? Come right in! Walk-ins are welcome, and we always prioritize severe
              injuries and illness.
            </Typography>
          </Box>

          <Schedule
            slotsLoading={locationLoading}
            waitingMinutes={waitingMinutes}
            slotData={slotData}
            timezone={locObjJson?.timezone || 'America/New_York'}
          />
          <Divider sx={{ marginTop: 3, marginBottom: 3 }} />
          <Typography variant="h4" color={theme.palette.primary.main}>
            Not seeing a time you need?
          </Typography>
          {/* TODO: configure redirect links */}
          <Typography variant="body2" color={theme.palette.text.primary} marginTop={1}>
            Check out one of our other offices:{' '}
            <Link style={{ color: theme.palette.primary.main }} target="_blank" to={'https://www.ottehr.com/'}>
              Example Office
            </Link>
          </Typography>
          <Typography variant="body2" color={theme.palette.text.primary} marginTop={1}>
            Or connect{' '}
            <Link style={{ color: theme.palette.primary.main }} target="_blank" to={'https://www.ottehr.com/'}>
              virtually
            </Link>
            .
          </Typography>
        </>
      )}
      {visitType === VisitType.WalkIn &&
        (!appointmentsLoading && !locationLoading ? (
          <>
            <Typography variant="body1" marginTop={2}>
              Please click on Continue to proceed to a page where you will enter your phone number. We&apos;ll verify if
              we have your information already. If we do, we will pre-fill your past information for a faster booking.
              If you already have a check-in time booked, please select Check-in option after login.
            </Typography>
            <Typography variant="body1" marginTop={1}>
              Please note that your family&apos;s information may be registered under a phone number owned by your
              partner, spouse, or child&apos;s guardian.
            </Typography>
            <PageForm
              onSubmit={() => {
                if (!isAuthenticated) {
                  // if the user is not signed in, redirect them to auth0
                  loginWithRedirect().catch((error) => {
                    throw new Error(`Error calling loginWithRedirect Auth0: ${error}`);
                  });
                } else {
                  // if the location has loaded and the user is signed in, redirect them to the landing page
                  navigate(getAuthedLandingPage());
                }
              }}
              controlButtons={{ backButton: false }}
            ></PageForm>
          </>
        ) : (
          <CircularProgress />
        ))}
    </CustomContainer>
  );
};

export default Welcome;
