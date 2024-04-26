import { useAuth0 } from '@auth0/auth0-react';
import { Typography } from '@mui/material';
import { DateTime } from 'luxon';
import mixpanel from 'mixpanel-browser';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useZambdaClient, PageForm } from 'ottehr-components';
import { IntakeFlowPageRoute } from '../App';
import { otherColors } from '../IntakeThemeProvider';
import { zapehrApi } from '../api';
import { AvailableLocationInformation } from '../api/zapehrApi';
import { ottehrWelcome } from '../assets/icons';
import { CustomContainer, CardWithDescriptionAndLink } from '../components';
import { safelyCaptureException } from '../helpers/sentry';
import { IntakeDataContext } from '../store';
import {
  updateAppointmentSlot,
  updatePatient,
  updatePatients,
  updateSelectedLocation,
  updateVisitType,
} from '../store/IntakeActions';
import { VisitType } from '../store/types';
import { Appointment } from './Appointments';

const WelcomeBack = (): JSX.Element => {
  const { state, dispatch } = useContext(IntakeDataContext);
  const navigate = useNavigate();
  const zambdaClient = useZambdaClient({ tokenless: false });
  const { isAuthenticated, isLoading } = useAuth0();
  const [loading, setLoading] = useState<boolean>(true);
  const [appointmentsLoading, setAppointmentsLoading] = useState<boolean>(true);

  useEffect(() => {
    mixpanel.track('Welcome Back');
  }, []);

  useEffect(() => {
    async function getPatients(): Promise<void> {
      setLoading(true);
      if (!zambdaClient) {
        // Wait for <IntakeFlow /> to set zambda client
        return;
      }

      const response = await zapehrApi.getPatients(zambdaClient, dispatch);
      const patients = response.patients;
      setLoading(false);

      if (patients.length > 0) {
        updatePatients(patients, dispatch);
      } else {
        // Navigate to NewUser if patients not found
        navigate(IntakeFlowPageRoute.NewUser.path);
      }
    }

    const storedVisitType = localStorage.getItem('visitType');
    if (storedVisitType) {
      updateVisitType(storedVisitType as VisitType, dispatch);
    }

    const storedLocationRaw = localStorage.getItem('currLocation');
    if (storedLocationRaw) {
      const storedLocation = JSON.parse(storedLocationRaw) as AvailableLocationInformation;
      updateSelectedLocation(storedLocation, dispatch);
    }

    const slot = localStorage.getItem('slot');
    if (slot) {
      updateAppointmentSlot(slot, dispatch);
    }
    if (!isLoading && !isAuthenticated) {
      navigate(IntakeFlowPageRoute.Welcome.path);
    } else if (isLoading && !isAuthenticated) {
      setLoading(true);
    } else if (isAuthenticated) {
      getPatients().catch((error) => {
        console.log(error);
        safelyCaptureException(error);
      });
    }
  }, [dispatch, isAuthenticated, isLoading, navigate, zambdaClient]);

  const onSubmit = (data: { patientID: string }): void => {
    let foundPatient = false;
    const currentInfo = state.patientInfo;
    if (!data.patientID) {
      throw new Error('No patient ID selected!');
    }
    if (currentInfo?.id !== data.patientID) {
      state.patients &&
        state.patients.forEach(async (currentPatient) => {
          if (currentPatient.id === data.patientID) {
            foundPatient = true;
            updatePatient(
              {
                id: currentPatient.id,
                newPatient: false,
                firstName: currentPatient.firstName,
                lastName: currentPatient.lastName,
                dateOfBirth: DateTime.fromISO(currentPatient.dateOfBirth || '').toString(),
                sex: currentPatient.sex,
                reasonForVisit: state.patientInfo?.reasonForVisit,
                email: currentPatient.email,
                emailUser: currentPatient.emailUser,
              },
              dispatch,
            );

            if (!zambdaClient) {
              throw new Error('zambdaClient is not defined');
            }
          }
        });
      if (!foundPatient) {
        updatePatient(
          {
            id: 'new-patient',
            newPatient: true,
            firstName: undefined,
            lastName: undefined,
            dateOfBirth: undefined,
            sex: undefined,
            reasonForVisit: undefined,
            email: undefined,
            emailUser: undefined,
          },
          dispatch,
        );
      }
    }
    // if existing patient was selected, route to ConfirmDateOfBirth
    if (data.patientID !== 'new-patient') {
      navigate(IntakeFlowPageRoute.ConfirmDateOfBirth.path);
    } else {
      navigate(IntakeFlowPageRoute.PatientInformation.path);
    }
  };

  // todo reduce code duplication with Welcome.tsx
  const checkInIfAppointmentBooked = useCallback(async () => {
    if (isAuthenticated && zambdaClient) {
      const response = await zapehrApi.getAppointments(zambdaClient, dispatch);
      const appointments: Appointment[] = response.appointments;
      for (const appointment of appointments) {
        if (state.visitType === VisitType.WalkIn && !appointment.checkedIn) {
          navigate(`/appointment/${appointment.id}/check-in`);
          break;
        }
      }
      setAppointmentsLoading(false);
    } else {
      setAppointmentsLoading(false);
    }
  }, [dispatch, isAuthenticated, navigate, state.visitType, zambdaClient]);

  useEffect(() => {
    if (state.visitType === VisitType.WalkIn) {
      setAppointmentsLoading(true);
      checkInIfAppointmentBooked().catch((error) => {
        console.log(error);
        safelyCaptureException(error);
      });
    } else {
      setAppointmentsLoading(false);
    }
  }, [checkInIfAppointmentBooked, state.visitType]);

  if (loading || appointmentsLoading) {
    return (
      <CustomContainer title="Loading..." bgVariant={IntakeFlowPageRoute.WelcomeBack.path}>
        <></>
      </CustomContainer>
    );
  }

  const onBack = (): void => {
    navigate(`/location/${state.selectedLocation?.slug}/${state.visitType}`);
  };

  return (
    <CustomContainer
      title="Welcome back!"
      bgVariant={IntakeFlowPageRoute.WelcomeBack.path}
      outsideCardComponent={
        state.visitType === VisitType.WalkIn ? (
          <CardWithDescriptionAndLink
            icon={ottehrWelcome}
            iconAlt="Calendar icon"
            iconHeight={50}
            mainText="Already reserved a check-in time?"
            textColor={otherColors.white}
            descText="Click here to check-in"
            link={IntakeFlowPageRoute.Appointments.path}
            linkText="Check in"
            bgColor={otherColors.brightPurple}
          />
        ) : undefined
      }
    >
      <Typography variant="body1" marginTop={2}>
        Please select from the options below so that we can pre-fill your past information for a faster booking.
      </Typography>
      <Typography variant="body1" marginTop={1} marginBottom={2}>
        You&apos;ll have the chance to confirm or update previously entered patient information shortly.
      </Typography>
      <PageForm
        formElements={[
          {
            type: 'Radio',
            name: 'patientID',
            label: 'Who is this visit for?',
            defaultValue: state.patientInfo?.id,
            required: true,
            radioOptions: (state.patients || [])
              .map((patient) => {
                if (!patient.id) {
                  throw new Error('Patient id is not defined');
                }
                return {
                  label: `${patient.firstName} ${patient.lastName}`,
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
        ]}
        onSubmit={onSubmit}
        controlButtons={{ onBack }}
      />
    </CustomContainer>
  );
};

export default WelcomeBack;
