import CloseIcon from '@mui/icons-material/Close';
import { Box, CircularProgress, Dialog, IconButton, Paper, Typography } from '@mui/material';
import { ottehrLightBlue } from '@theme/icons';
import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';
import { FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { CancellationReasonOptionsInPerson, getDateComponentsFromISOString, PROJECT_NAME, VisitType } from 'utils';
import { ottehrApi } from '../api';
import { intakeFlowPageRoute } from '../App';
import { CardWithDescriptionAndLink, PageContainer } from '../components';
import { CustomLoadingButton } from '../components/CustomLoadingButton';
import { ErrorDialog, ErrorDialogConfig } from '../components/ErrorDialog';
import PatientList from '../features/patients/components/selectable-list';
import { safelyCaptureException } from '../helpers/sentry';
import { useNavigateInFlow } from '../hooks/useNavigateInFlow';
import { useUCZambdaClient, ZambdaClient } from '../hooks/useUCZambdaClient';
import { otherColors } from '../IntakeThemeProvider';
import { Appointment } from '../types';
import { useBookingContext } from './BookingHome';

const ChoosePatient = (): JSX.Element => {
  const navigate = useNavigate();
  const zambdaClient = useUCZambdaClient({ tokenless: false });

  const {
    startISO,
    patients,
    patientInfo,
    visitType,
    slotId,
    timezone,
    patientsLoading,
    scheduleOwnerName,
    setPatientInfo,
  } = useBookingContext();
  const [appointmentsLoading, setAppointmentsLoading] = useState<boolean>(false);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [checkInModalOpen, setCheckInModalOpen] = useState<boolean>(false);
  const [appointmentsToCheckIn, setAppointmentsToCheckIn] = useState<Appointment[]>([]);
  const [appointmentsToCancel, setAppointmentsToCancel] = useState<Appointment[]>([]);
  const [bookedAppointment, setBookedAppointment] = useState<Appointment>();
  const [cancellingAppointment, setCancellingAppointment] = useState<boolean>(false);
  const [errorDialog, setErrorDialog] = useState<ErrorDialogConfig | undefined>(undefined);
  const { t } = useTranslation();

  const navigateInFlow = useNavigateInFlow();

  // todo: consider whether this is better handled in BookingHome
  useEffect(() => {
    const getAppointmentsTodayAndTomorrow = async (): Promise<void> => {
      try {
        if (!zambdaClient) {
          throw new Error('zambdaClient is not defined');
        }
        setAppointmentsLoading(true);
        const todayStart = DateTime.now().setZone(timezone).startOf('day');
        const tomorrowEnd = todayStart.plus({ day: 1 }).endOf('day');
        const response = await ottehrApi.getAppointments(zambdaClient, {
          dateRange: { greaterThan: todayStart.toISO() || '', lessThan: tomorrowEnd.toISO() || '' },
        });
        setAllAppointments(response.appointments ?? []);
      } catch (error) {
        safelyCaptureException(error);
      } finally {
        setAppointmentsLoading(false);
      }
    };

    if (timezone) {
      getAppointmentsTodayAndTomorrow().catch((error) => console.log(error));
    }
  }, [timezone, zambdaClient]);

  const { todayAppointments, tomorrowAppointments, showCheckIn } = useMemo(() => {
    let todayAppointments: Appointment[] = [];
    let tomorrowAppointments: Appointment[] = [];
    let showCheckIn = false;

    if (!allAppointments.length || timezone) {
      return { todayAppointments, tomorrowAppointments, showCheckIn };
    }

    const todayStart = DateTime.now().setZone(timezone).startOf('day');
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
        !appointment.checkedIn && appointment.status !== 'fulfilled' && appointment.slotId === slotId
    );

    return { todayAppointments, tomorrowAppointments, showCheckIn };
  }, [allAppointments, slotId, timezone]);

  const onSubmit = async (data: FieldValues): Promise<void> => {
    let foundPatient = false;
    let patientFirstName = patientInfo?.firstName;
    const currentInfo = patientInfo;
    if (!data.patientID) {
      throw new Error('No patient ID selected!');
    }

    if (patients) {
      patients.forEach(async (currentPatient) => {
        const {
          year: dobYear,
          month: dobMonth,
          day: dobDay,
        } = getDateComponentsFromISOString(currentPatient?.dateOfBirth);
        if (patientInfo?.id && patientInfo.id === currentPatient.id && currentPatient.id === data.patientID) {
          // console.log('path 1');
          foundPatient = true;
          // don't overwrite what's already in the booking store if we haven't chosen a new patient
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
    }
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
        (appointment: Appointment) => appointment.slotId === slotId || appointment.location?.name === scheduleOwnerName
      );
      const cancels = patientAppointments.filter(
        (appointment: Appointment) => appointment.location?.name !== scheduleOwnerName
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
    console.log('already booked', patientID);
    let bookedAppointmentID: string | undefined;

    if (patientID && timezone) {
      // get appointments for the selected slot date
      // can't use strict equality for luxon datetimes so use equals() instead
      const today = DateTime.now().setZone(timezone).startOf('day');
      const selectedSlotDay = DateTime.fromISO(startISO).setZone(timezone).startOf('day');
      const appointments = selectedSlotDay.equals(today) ? todayAppointments : tomorrowAppointments;

      // check if selected patient already has appointment and return its id
      const alreadyBookedAtThisLocation = appointments.find(
        (appointment: Appointment) =>
          appointment.patientID === patientID &&
          appointment.slotId === slotId &&
          appointment.visitStatus !== 'completed'
      );
      bookedAppointmentID = alreadyBookedAtThisLocation?.id;
    }
    return bookedAppointmentID;
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
    await ottehrApi.cancelAppointment(
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
      await ottehrApi.cancelAppointment(
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

  if (patientsLoading || appointmentsLoading) {
    return (
      <PageContainer title={t('welcomeBack.loading')}>
        <CircularProgress />
      </PageContainer>
    );
  } else if (patients && patients.length === 0) {
    // if there are no patients, redirect to the new patient page without requiring user
    // to select the "new family member" option
    void onSubmit({ patientID: 'new-patient' });
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
            iconAlt={`${PROJECT_NAME} icon`}
            mainText={t('welcomeBack.alreadyReserved')}
            textColor={otherColors.white}
            descText={t('welcomeBack.checkIn')}
            link={intakeFlowPageRoute.Appointments.path}
            linkText={t('appointments.checkIn')}
            bgColor={otherColors.purple}
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
      <PatientList
        patients={patients}
        subtitle={t('welcomeBack.subtitle')}
        selectedPatient={patientInfo}
        buttonLoading={cancellingAppointment}
        onSubmit={onSubmit}
        onBack={onBack}
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
              {t('welcomeBack.errors.alreadyBooked.body3')} {scheduleOwnerName || 'Unknown'}.
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

export default ChoosePatient;
