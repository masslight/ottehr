/* eslint-disable @typescript-eslint/no-unused-vars */
import { useAuth0 } from '@auth0/auth0-react';
import CloseIcon from '@mui/icons-material/Close';
import { Box, CircularProgress, Dialog, IconButton, Paper, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';
import { FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CustomLoadingButton,
  ErrorDialog,
  ErrorDialogConfig,
  FormInputType,
  PageForm,
  useUCZambdaClient,
  ZambdaClient,
} from 'ui-components';
import {
  CancellationReasonOptionsInPerson,
  getDateComponentsFromISOString,
  getPatientInfoFullName,
  VisitType,
} from 'utils';
import { intakeFlowPageRoute } from '../App';
import { otherColors } from '../IntakeThemeProvider';
import { zapehrApi } from '../api';
import { ottehrLightBlue } from '../assets/icons';
import { CardWithDescriptionAndLink, PageContainer } from '../components';
import { safelyCaptureException } from '../helpers/sentry';
import { useNavigateInFlow } from '../hooks/useNavigateInFlow';
import { usePreserveQueryParams } from '../hooks/usePreserveQueryParams';
import { Appointment } from '../types';
import { useBookingContext } from './Welcome';

const WelcomeBack = (): JSX.Element => {
  const navigate = useNavigate();
  const zambdaClient = useUCZambdaClient({ tokenless: false });
  const { isAuthenticated, isLoading: authIsLoading, loginWithRedirect } = useAuth0();
  const {
    patients,
    patientInfo,
    visitType,
    selectedLocation,
    patientsLoading,
    setPatientInfo,
    //selectedSlot,
    scheduleType,
  } = useBookingContext();
  const [appointmentsLoading, setAppointmentsLoading] = useState<boolean>(true);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [checkInModalOpen, setCheckInModalOpen] = useState<boolean>(false);
  const [appointmentsToCheckIn, setAppointmentsToCheckIn] = useState<Appointment[]>([]);
  const [appointmentsToCancel, setAppointmentsToCancel] = useState<Appointment[]>([]);
  const [bookedAppointment, setBookedAppointment] = useState<Appointment>();
  const [cancellingAppointment, setCancellingAppointment] = useState<boolean>(false);
  const [errorDialog, setErrorDialog] = useState<ErrorDialogConfig | undefined>(undefined);
  const { slug: slugParam, visit_type: visitTypeParam, state: stateParam } = useParams();
  const preserveQueryParams = usePreserveQueryParams();
  const { t } = useTranslation();

  const navigateInFlow = useNavigateInFlow();

  /*
  useEffect(() => {
    if (visitType === VisitType.WalkIn && !walkinOpen) {
      navigate(getStartingPath(selectedLocation, visitType, serviceType, selectedSlot), {
        state: { reschedule: true },
        replace: true,
      });
    }
  }, [selectedLocation, visitType, serviceType, selectedSlot, walkinOpen, navigate]);
  */

  const formElements: FormInputType[] = useMemo(() => {
    return [
      {
        type: 'Radio',
        name: 'patientID',
        label: t('welcomeBack.subtitle'),
        defaultValue: patientInfo?.id,
        required: true,
        radioOptions: (patients || [])
          .sort((a, b) => {
            if (!a.firstName) return 1;
            if (!b.firstName) return -1;
            return a.firstName.localeCompare(b.firstName);
          })
          .map((patient) => {
            if (!patient.id) {
              throw new Error('Patient id is not defined');
            }
            return {
              label: getPatientInfoFullName(patient),
              value: patient.id,
              color: otherColors.lightBlue,
            };
          })
          .concat({
            label: 'Different family member',
            value: 'new-patient',
            color: otherColors.lightBlue,
          }),
      },
    ];
  }, [patientInfo?.id, patients, t]);

  useEffect(() => {
    const getAppointmentsTodayAndTomorrow = async (): Promise<void> => {
      try {
        if (!zambdaClient) {
          throw new Error('zambdaClient is not defined');
        }
        setAppointmentsLoading(true);
        const timezone = selectedLocation?.timezone;
        const todayStart = DateTime.now().setZone(timezone).startOf('day');
        const tomorrowEnd = todayStart.plus({ day: 1 }).endOf('day');
        const response = await zapehrApi.getAppointments(zambdaClient, {
          dateRange: { greaterThan: todayStart.toISO() || '', lessThan: tomorrowEnd.toISO() || '' },
        });
        setAllAppointments(response.appointments ?? []);
      } catch (error) {
        safelyCaptureException(error);
      } finally {
        setAppointmentsLoading(false);
      }
    };

    if (selectedLocation?.timezone) {
      getAppointmentsTodayAndTomorrow().catch((error) => console.log(error));
    }
  }, [selectedLocation?.timezone, zambdaClient]);

  const { todayAppointments, tomorrowAppointments, showCheckIn } = useMemo(() => {
    let todayAppointments: Appointment[] = [];
    let tomorrowAppointments: Appointment[] = [];
    let showCheckIn = false;

    if (!allAppointments.length || !selectedLocation?.timezone) {
      return { todayAppointments, tomorrowAppointments, showCheckIn };
    }

    const todayStart = DateTime.now().setZone(selectedLocation.timezone).startOf('day');
    const tomorrowStart = todayStart.plus({ day: 1 });
    todayAppointments = allAppointments.filter(
      (appointment: Appointment) =>
        DateTime.fromISO(appointment.start).setZone(appointment.location?.timezone) < tomorrowStart
    );
    tomorrowAppointments = allAppointments.filter(
      (appointment: Appointment) =>
        DateTime.fromISO(appointment.start).setZone(appointment.location?.timezone) >= tomorrowStart
    );
    // console.log('today', todayAppointments, 'tomorrow', tomorrowAppointments);
    showCheckIn = todayAppointments.some(
      (appointment: Appointment) =>
        !appointment.checkedIn &&
        appointment.status !== 'fulfilled' &&
        appointment.location?.name === selectedLocation?.name
    );

    return { todayAppointments, tomorrowAppointments, showCheckIn };
  }, [allAppointments, selectedLocation?.name, selectedLocation?.timezone]);

  const onSubmit = async (data: FieldValues): Promise<void> => {
    let foundPatient = false;
    let patientFirstName = patientInfo?.firstName;
    const currentInfo = patientInfo;
    if (!data.patientID) {
      throw new Error('No patient ID selected!');
    }

    patients &&
      patients.forEach(async (currentPatient) => {
        const {
          year: dobYear,
          month: dobMonth,
          day: dobDay,
        } = getDateComponentsFromISOString(currentPatient?.dateOfBirth);
        if (patientInfo?.id && patientInfo.id === currentPatient.id && currentPatient.id === data.patientID) {
          // console.log('path 1');
          foundPatient = true;
          // don't overrwrite what's alrady in the booking store if we haven't chosen a new patient
        } else if (currentPatient.id === data.patientID) {
          // console.log('path 2');
          foundPatient = true;
          patientFirstName = data.firstName || currentPatient.firstName;
          setPatientInfo({
            id: currentPatient.id,
            newPatient: false,
            firstName: data.firstName || currentPatient.firstName,
            middleName: data.middleName || currentPatient.middleName,
            lastName: data.lastName || currentPatient.lastName,
            dobYear,
            dobDay,
            dobMonth,
            sex: data.sex || currentPatient.sex,
            reasonForVisit: data.reasonForVisit || patientInfo?.reasonForVisit,
            email: data.email || currentPatient.email,
          });
        }
      });
    if (!foundPatient) {
      // console.log('did not find patient in the patients list');
      if (currentInfo?.id === 'new-patient' && data.patientID === 'new-patient') {
        // is this path ever reached?
        // yes if you click back on from the about the patient page with new patient selected
        // console.log('path 3');
        // console.log('new patient is chosen and have new patient data in the state, will use it');
      } else {
        // console.log('path 4');
        setPatientInfo({
          id: 'new-patient',
          newPatient: true,
          firstName: undefined,
          lastName: undefined,
          dobYear: undefined,
          dobDay: undefined,
          dobMonth: undefined,
          sex: undefined,
          reasonForVisit: undefined,
          email: undefined,
        });
      }
    }

    if (data.patientID !== 'new-patient') {
      if (visitType === VisitType.WalkIn) {
        // If returning patient walks in determine if they need to check in or walk in
        await getAppointmentsAndContinue(data.patientID);
      } else {
        // check for slot hoarding (this condition is ignored locally)
        const bookedAppointmentID = alreadyBooked(data.patientID);
        if (bookedAppointmentID && window.location.hostname !== 'localhost') {
          setErrorDialog({
            title: 'Error',
            description: (
              <>
                {t('welcomeBack.errors.alreadyRegistered.body1')} {patientFirstName}{' '}
                {t('welcomeBack.errors.alreadyRegistered.body2')}{' '}
                <Link to={`/visit/${bookedAppointmentID}`} target="_blank">
                  {t('welcomeBack.errors.alreadyRegistered.link')}
                </Link>
                .
              </>
            ),
          });
        } else {
          // Continue prebook flow for returning patient
          navigateInFlow('confirm-date-of-birth');
        }
      }
    } else {
      // New patient
      navigateInFlow('patient-information');
    }
  };

  const getAppointmentsAndContinue = async (patientID: string): Promise<void> => {
    try {
      let patientAppointments: Appointment[] = [];
      if (patientID) {
        patientAppointments = todayAppointments.filter(
          (appointment: Appointment) =>
            appointment.patientID === patientID && !appointment.checkedIn && appointment.status !== 'fulfilled'
        );
      }
      const checkIns = patientAppointments.filter(
        (appointment: Appointment) => appointment.location?.name === selectedLocation?.name
      );
      const cancels = patientAppointments.filter(
        (appointment: Appointment) => appointment.location?.name !== selectedLocation?.name
      );

      setAppointmentsToCheckIn(checkIns);
      setAppointmentsToCancel(cancels);
      await checkInIfAppointmentBooked(checkIns, cancels);
    } catch (error) {
      console.log(error);
      safelyCaptureException(error);
    } finally {
      setAppointmentsLoading(false);
    }
  };

  const alreadyBooked = (patientID: string): string | undefined => {
    // todo: return the appointment id from the slot details if it matches with some already booked appointment for the patient
    console.log('already booked', patientID);
    return undefined;
    /*(let bookedAppointmentID: string | undefined;
    const timezone = selectedLocation?.timezone;

    if (patientID && timezone) {
      // get appointments for the selected slot date
      // can't use strict equality for luxon datetimes so use equals() instead
      const today = DateTime.now().setZone(timezone).startOf('day');
      const selectedSlotDay = DateTime.fromISO(selectedSlot).setZone(timezone).startOf('day');
      const appointments = selectedSlotDay.equals(today) ? todayAppointments : tomorrowAppointments;

      // check if selected patient already has appointment and return its id
      const alreadyBookedAtThisLocation = appointments.find(
        (appointment: Appointment) =>
          appointment.patientID === patientID &&
          appointment.location?.name === selectedLocation?.name &&
          appointment.visitStatus !== 'completed'
      );
      bookedAppointmentID = alreadyBookedAtThisLocation?.id;
    }
    return bookedAppointmentID;
    */
  };

  const checkInIfAppointmentBooked = async (checkIns: Appointment[], cancels: Appointment[]): Promise<void> => {
    if (!cancels.length && !checkIns.length) {
      // Continue walk-in flow for returning patient
      navigateInFlow('confirm-date-of-birth');
    } else if (!cancels.length && checkIns.length) {
      // Check in or walk in to location where appointment is booked
      const appointment = checkIns[0];
      const timezone = appointment.location?.timezone;
      const now = DateTime.now().setZone(timezone);
      const start = DateTime.fromISO(checkIns[0].start).setZone(timezone);
      const hoursBeforeArrival = start.diff(now).as('hours');

      if (hoursBeforeArrival > 4 && visitType !== VisitType.PostTelemed) {
        // If patient walks in more than 4 hours before their pre-booked slot then cancel the appointment and walk-in
        await handleCancelAppointmentForSelectedLocation(appointment.id, zambdaClient);
        navigateInFlow('confirm-date-of-birth');
      } else {
        // If patient walks in less than 4 hours before their prebook time then check in to the earliest pre-booked appointment
        navigate(`/visit/${appointment.id}/check-in`);
      }
    } else {
      // If appointment location is not selected location then prompt to cancel
      // booked appointment before walking in
      setBookedAppointment(cancels[0]);
      setCheckInModalOpen(true);
    }
  };

  const handleCancelAppointmentForSelectedLocation = async (
    appointmentID: string,
    zambdaClient: ZambdaClient | null
  ): Promise<void> => {
    if (!zambdaClient) {
      // Fail silently
      return;
    }
    setCancellingAppointment(true);
    await zapehrApi.cancelAppointment(
      zambdaClient,
      {
        appointmentID: appointmentID,
        cancellationReason: CancellationReasonOptionsInPerson['Duplicate visit or account error'],
        silent: true,
        language: 'en', // replace with i18n.language to enable
      },
      false
    );
    setCancellingAppointment(false);
  };

  const handleCancelAppointmentForAnotherLocation = async (): Promise<void> => {
    if (zambdaClient && bookedAppointment) {
      setCancellingAppointment(true);
      await zapehrApi.cancelAppointment(
        zambdaClient,
        {
          appointmentID: bookedAppointment.id,
          cancellationReason: CancellationReasonOptionsInPerson['Duplicate visit or account error'],
          language: 'en', // replace with i18n.language to enable
        },
        false
      );
      setCancellingAppointment(false);
    }
    const remainingAppointments = appointmentsToCancel?.slice(1) || [];
    setAppointmentsToCancel(remainingAppointments);
    setCheckInModalOpen(false);
    await checkInIfAppointmentBooked(appointmentsToCheckIn, remainingAppointments);
  };

  const appointmentTimezoneAdjusted = useMemo(() => {
    const bookedAppointmentStart = bookedAppointment?.start;
    if (bookedAppointmentStart) {
      return DateTime.fromISO(bookedAppointmentStart)
        .setZone(bookedAppointment?.location?.timezone)
        .setLocale('en-us')
        .toFormat('h:mm a ZZZZ');
    }

    return undefined;
  }, [bookedAppointment]);

  // console.log('loading, authIsLoading', loading, authIsLoading);
  // console.log('patients loading?', patientsLoading);

  if (!isAuthenticated && !authIsLoading) {
    // if the user is not signed in, redirect them to auth0
    loginWithRedirect({
      appState: {
        target: preserveQueryParams(`/${scheduleType}/${stateParam}/${slugParam}/${visitTypeParam}/patients`),
      },
    }).catch((error) => {
      throw new Error(`Error calling loginWithRedirect Auth0: ${error}`);
    });
  }

  if (patientsLoading || authIsLoading || appointmentsLoading) {
    return (
      <PageContainer title={t('welcomeBack.loading')}>
        <CircularProgress />
      </PageContainer>
    );
  }

  const onBack = (): void => {
    navigate(`/home`);
  };

  return (
    <PageContainer
      title={t('welcomeBack.title')}
      topOutsideCardComponent={
        visitType === VisitType.WalkIn && showCheckIn ? (
          <CardWithDescriptionAndLink
            iconHeight={50}
            icon={ottehrLightBlue}
            iconAlt="ottehr icon"
            mainText={t('welcomeBack.alreadyReserved')}
            textColor={otherColors.white}
            descText={t('welcomeBack.checkIn')}
            link={intakeFlowPageRoute.Appointments.path}
            linkText={t('appointments.checkIn')}
            bgColor={otherColors.brightPurple}
            marginTop={0}
            marginBottom={2}
            paddingY={6}
          />
        ) : undefined
      }
    >
      <Typography variant="body1" marginTop={2}>
        {t('welcomeBack.body1')}
      </Typography>
      <Typography variant="body1" marginTop={1} marginBottom={2}>
        {t('welcomeBack.body2')}
      </Typography>
      <PageForm
        formElements={formElements}
        onSubmit={onSubmit}
        controlButtons={{ onBack, loading: cancellingAppointment }}
      />
      <Dialog open={checkInModalOpen} onClose={() => setCheckInModalOpen(false)}>
        <Paper>
          <Box margin={5} maxWidth="sm">
            <Typography variant="h3" color="primary">
              {t('welcomeBack.cancel.cancel1')} {bookedAppointment?.firstName || 'Unknown'}
              {t('welcomeBack.cancel.cancel2')} {bookedAppointment ? `${bookedAppointment.location?.name}` : 'Unknown'}{' '}
              {t('welcomeBack.cancel.cancel3')} {appointmentTimezoneAdjusted}
            </Typography>
            <Typography marginTop={2} marginBottom={2}>
              {t('welcomeBack.errors.alreadyBooked.body1')} {bookedAppointment?.location?.name || 'Unknown'}{' '}
              {t('welcomeBack.errors.alreadyBooked.body2')} {appointmentTimezoneAdjusted}.{' '}
              {t('welcomeBack.errors.alreadyBooked.body3')} {selectedLocation?.name || 'Unknown'}.
            </Typography>
            <Box display="flex" justifyContent="flex-end">
              <CustomLoadingButton
                onClick={handleCancelAppointmentForAnotherLocation}
                loading={cancellingAppointment}
                sx={{ marginTop: 2 }}
              >
                {t('welcomeBack.cancel.title')}
              </CustomLoadingButton>
            </Box>
            <IconButton
              aria-label={t('welcomeBack.cancel.close')}
              onClick={() => setCheckInModalOpen(false)}
              sx={{
                position: 'absolute',
                right: 8,
                top: 8,
                color: otherColors.scheduleBorder,
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Paper>
      </Dialog>
      <ErrorDialog
        open={!!errorDialog}
        title={errorDialog?.title || ''}
        description={errorDialog?.description || ''}
        closeButtonText={t('welcomeBack.cancel.close')}
        handleClose={() => {
          setErrorDialog(undefined);
        }}
      />
    </PageContainer>
  );
};

export default WelcomeBack;
