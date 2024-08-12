import { Skeleton, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { IntakeFlowPageRoute } from '../App';
import { otherColors } from '../IntakeThemeProvider';
import { useGetAppointments } from '../features/appointments';
import { CustomContainer, useIntakeCommonStore } from '../features/common';
import HomepageOption from '../features/homepage/HomepageOption';
import { useZapEHRAPIClient } from '../utils';
import { requestVisit, pastVisits, contactSupport } from '../assets/icons';

const PatientPortal = (): JSX.Element => {
  const apiClient = useZapEHRAPIClient();
  const navigate = useNavigate();

  const { data: appointmentsData, isFetching } = useGetAppointments(apiClient, Boolean(apiClient));

  const activeAppointment = appointmentsData?.appointments.find((appointment) =>
    ['ready', 'pre-video', 'on-video'].includes(appointment.telemedStatus),
  );

  const isAppointmentStatusReady = Boolean(activeAppointment);

  const appointmentID = activeAppointment?.id || '';

  const handleRequestVisit = (): void => {
    navigate(
      `${IntakeFlowPageRoute.Welcome.path.replace(':schedule-type', 'provider').replace(':slug', 'daniel').replace(':visit-service', 'in-person').replace(':visit-type', 'prebook')}`,
    );
  };

  const handleReturnToCall = (): void => {
    navigate(`${IntakeFlowPageRoute.WaitingRoom.path}?appointment_id=${appointmentID}`);
  };

  const handlePastVisits = (): void => {
    navigate(`${IntakeFlowPageRoute.SelectPatient.path}?flow=pastVisits`);
  };

  const handleContactSupport = (): void => {
    useIntakeCommonStore.setState({ supportDialogOpen: true });
  };

  return (
    <CustomContainer
      title="Welcome to Ottehr Telemedicine"
      description=""
      bgVariant={IntakeFlowPageRoute.PatientPortal.path}
      isFirstPage={true}
    >
      {isFetching ? (
        <Skeleton
          sx={{
            borderRadius: 2,
            backgroundColor: otherColors.coachingVisit,
            p: 10,
            mt: -4,
          }}
        />
      ) : (
        <>
          {isAppointmentStatusReady && (
            <HomepageOption
              title="Return to Call"
              icon={requestVisit}
              handleClick={handleReturnToCall}
              subSlot={
                <Typography
                  variant="overline"
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    backgroundColor: '#FFD271',
                    color: '#A67100',
                    borderRadius: 1,
                    px: 1,
                  }}
                >
                  Active call
                </Typography>
              }
            />
          )}
          {/* {!isAppointmentStatusReady && (
            <HomepageOption title="Request Visit" icon={requestVisit} handleClick={handleRequestVisit} />
          )} */}

          <HomepageOption title="Request Visit" icon={requestVisit} handleClick={handleRequestVisit} />

          <HomepageOption
            title="Past Visits"
            icon={pastVisits}
            handleClick={handlePastVisits}
            subtitle="School/Work Notes and Prescriptions"
          />
        </>
      )}
      <HomepageOption title="Contact Support" icon={contactSupport} handleClick={handleContactSupport} />
    </CustomContainer>
  );
};

export default PatientPortal;
