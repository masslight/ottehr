import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Box, Button, CircularProgress, Grid, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import mixpanel from 'mixpanel-browser';
import { useContext, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useZambdaClient } from 'ottehr-components';
import { IntakeFlowPageRoute } from '../App';
import { otherColors, palette } from '../IntakeThemeProvider';
import zapehrApi from '../api/zapehrApi';
import { ottehrWelcome } from '../assets/icons';
import { CustomContainer, CardWithDescriptionAndLink } from '../components';
import { DATETIME_FULL_NO_YEAR } from '../helpers';
import { appointmentNotFoundInformation } from '../helpers/information';
import { safelyCaptureException } from '../helpers/sentry';
import { IntakeDataContext } from '../store';
import { VisitType } from '../store/types';

interface CheckInInformation {
  location: { name: string; slug: string; timezone: string };
  visitType: string;
  start: string;
  paperworkCompleted: boolean;
}

const CheckIn = (): JSX.Element => {
  const { state, dispatch } = useContext(IntakeDataContext);
  const zambdaClient = useZambdaClient({ tokenless: true });
  const { id: appointmentID } = useParams();
  const [checkIn, setCheckIn] = useState<CheckInInformation | undefined>(undefined);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    mixpanel.track('Check In');
  }, []);

  useEffect(() => {
    async function updateAppointment(): Promise<void> {
      if (!zambdaClient) {
        throw new Error('zambda client is undefined');
      }
      if (!checkIn) {
        setCheckIn(await zapehrApi.checkIn(zambdaClient, appointmentID || '', dispatch));
      }
    }
    updateAppointment().catch((error) => {
      safelyCaptureException(error);
      if (error.message === 'Appointment is not found') {
        setNotFound(true);
      } else {
        console.log('error', error);
      }
    });
  }, [zambdaClient, checkIn, appointmentID, dispatch]);

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
        title={'There was an error checking in for this appointment'}
        description={appointmentNotFoundInformation}
        bgVariant={IntakeFlowPageRoute.CheckIn.path}
      >
        <></>
      </CustomContainer>
    );
  }

  return (
    <CustomContainer
      title={checkIn ? 'You are checked in!' : 'Checking in...'}
      bgVariant={IntakeFlowPageRoute.CheckIn.path}
      outsideCardComponent={
        checkIn && (checkIn.visitType as VisitType) === VisitType.WalkIn ? (
          <CardWithDescriptionAndLink
            icon={ottehrWelcome}
            iconAlt="Clipboard with pencil icon"
            iconHeight={60}
            mainText={undefined}
            textColor={otherColors.white}
            descText="We need your feedback on this new registration system"
            link="https://example.com"
            linkText="1-minute survey"
            largerLinkTextSpace
            bgColor={otherColors.brightPurple}
          />
        ) : undefined
      }
    >
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
                minHeight: 60,
              }}
            >
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '16px',
                  color: otherColors.darkPurple,
                }}
                variant="body1"
                marginTop={2}
              >
                {checkIn.paperworkCompleted ? 'Your paperwork is complete' : 'Paperwork incomplete'}
              </Typography>
              <Box sx={{ display: 'flex' }} mt={1}>
                <Link to={`/appointment/${appointmentID}`} style={{ textDecoration: 'none', display: 'inline-flex' }}>
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
                    Edit
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
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '16px',
                  color: otherColors.darkPurple,
                }}
                variant="body1"
              >
                You are checked in
              </Typography>
              <Typography variant="body1" color={palette.secondary.main} marginTop={1}>
                Today,{' '}
                {DateTime.fromISO(checkIn.start)
                  .setZone(checkIn.location.timezone)
                  .setLocale('en-us')
                  .toFormat(DATETIME_FULL_NO_YEAR)}
              </Typography>
              <Typography variant="body1" color={palette.secondary.main} marginTop={1}>
                {checkIn.location.name}
              </Typography>
            </Box>
          </Box>
          <Grid container marginTop={2}>
            <Grid item xs={12} md={6} textAlign={{ xs: 'center', md: 'start' }} justifyContent="start">
              <Link to={`/location/${checkIn.location.slug}/${VisitType.WalkIn}`} onClick={updateState}>
                <Button variant="outlined">Register another patient</Button>
              </Link>
            </Grid>
            <Grid item xs={12} md={6} textAlign={{ xs: 'center', md: 'end' }} justifyContent="end">
              <Link to={`/appointments`} onClick={updateState}>
                <Button variant="contained">Reserved check-in times</Button>
              </Link>
            </Grid>
          </Grid>
        </>
      )}
    </CustomContainer>
  );
};

export default CheckIn;
