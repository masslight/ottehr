import CloseIcon from '@mui/icons-material/Close';
import LiveHelpOutlinedIcon from '@mui/icons-material/LiveHelpOutlined';
import VideoCameraFrontOutlinedIcon from '@mui/icons-material/VideoCameraFrontOutlined';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import { Box, Button, Skeleton, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { generatePath, useNavigate } from 'react-router-dom';
import { ServiceMode, VisitType } from 'utils';
import { BOOKING_SERVICE_MODE_PARAM, bookingBasePath, intakeFlowPageRoute } from '../../App';
import { otherColors } from '../../IntakeThemeProvider';
import { CancelVisitDialog } from '../components';
import {
  findActiveAppointment,
  useAppointmentsData,
  useAppointmentStore,
  useGetAppointments,
} from '../features/appointments';
import { CustomContainer, useIntakeCommonStore } from '../features/common';
import HomepageOption from '../features/homepage/HomepageOption';
import { useZapEHRAPIClient } from '../utils';
import { dataTestIds } from '../../helpers/data-test-ids';
import { PROJECT_NAME } from '../../helpers';
import { pastVisits } from '@theme/icons';

const Homepage = (): JSX.Element => {
  const apiClient = useZapEHRAPIClient();
  const navigate = useNavigate();
  const [isCancelVisitDialogOpen, setCancelVisitDialogOpen] = useState<boolean>(false);
  const { isAppointmentsFetching, refetchAppointments, appointments } = useAppointmentsData();
  const activeAppointment = useMemo(() => findActiveAppointment(appointments), [appointments]);
  const isAppointmentStatusProposed = activeAppointment?.appointmentStatus === 'proposed';
  const appointmentID = activeAppointment?.id || '';
  const { refetch } = useGetAppointments(apiClient, Boolean(apiClient));

  useEffect(() => {
    if (apiClient) {
      // TODO research option invalidate cache on the place to rid of useEffects with manually refetching
      void refetch();
    }
  }, [refetch, apiClient]);

  const handleRequestVisit = (): void => {
    navigate(`${intakeFlowPageRoute.TelemedSelectPatient.path}?flow=requestVisit`);
  };

  const handleWalkIn = (): void => {
    /*
      This hardcoded location simulates an experience where a patient who walks in to a physical locaiton is given a
      link to register for a walk-in visit. this might be something a front desk person texts to the individual after getting
      their phone number, or maybe a link the user opens by scanning a QR code made available at the location. 
    */
    const basePath = generatePath(bookingBasePath, {
      slug: 'testing',
      visit_type: `${VisitType.WalkIn}`,
      service_mode: ServiceMode['in-person'],
    });

    navigate(`${basePath}/patients`, {
      state: { scheduleType: 'location' },
    });
  };

  const handleReturnToCall = (): void => {
    navigate(`${intakeFlowPageRoute.WaitingRoom.path}?appointment_id=${appointmentID}`);
  };

  const handleContinueRequest = (): void => {
    useAppointmentStore.setState({ appointmentDate: activeAppointment?.start, appointmentID });
    navigate(`${intakeFlowPageRoute.TelemedSelectPatient.path}?flow=continueVisitRequest`, {
      state: { patientId: activeAppointment?.patient?.id },
    });
  };

  const handlePastVisits = (): void => {
    navigate(`${intakeFlowPageRoute.TelemedSelectPatient.path}?flow=pastVisits`);
  };

  const handleContactSupport = (): void => {
    useIntakeCommonStore.setState({ supportDialogOpen: true });
  };

  const handleInPerson = (): void => {
    const destination = `${intakeFlowPageRoute.PrebookVisitDynamic.path.replace(
      `:${BOOKING_SERVICE_MODE_PARAM}`,
      ServiceMode['in-person']
    )}?bookingOn=SeldenNY&scheduleType=group`;
    navigate(destination);
  };

  const handleScheduleVirtual = (): void => {
    navigate(
      intakeFlowPageRoute.PrebookVisitDynamic.path.replace(`:${BOOKING_SERVICE_MODE_PARAM}`, ServiceMode['virtual'])
    );
  };

  return (
    <CustomContainer title={`Welcome to ${PROJECT_NAME}`} description="" isFirstPage={true}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {isAppointmentsFetching ? (
          <Skeleton
            variant="rounded"
            height={115}
            sx={{
              borderRadius: 2,
              backgroundColor: otherColors.coachingVisit,
            }}
          />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {activeAppointment && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
                <HomepageOption
                  title={isAppointmentStatusProposed ? 'Continue Virtual Visit Request' : 'Return to Call'}
                  icon={<VideoCameraFrontOutlinedIcon />}
                  handleClick={isAppointmentStatusProposed ? handleContinueRequest : handleReturnToCall}
                  subSlot={
                    isAppointmentStatusProposed ? undefined : (
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
                    )
                  }
                />
                {isAppointmentStatusProposed && (
                  <Button onClick={() => setCancelVisitDialogOpen(true)} startIcon={<CloseIcon />}>
                    Cancel this request
                  </Button>
                )}
              </Box>
            )}

            {/*{!isAppointmentStatusReady && (*/}
            {/*  <HomepageOption title="Request a Virtual Visit" icon={requestVisit} handleClick={handleRequestVisit} />*/}
            {/*)}*/}

            <HomepageOption
              title="Schedule a Virtual Visit"
              icon={<VideoCameraFrontOutlinedIcon />}
              handleClick={handleScheduleVirtual}
              dataTestId={dataTestIds.scheduleVirtualVisitButton}
            />
            <HomepageOption
              title="Schedule an In-Person Visit"
              icon={<LocalHospitalOutlinedIcon />}
              handleClick={handleInPerson}
              dataTestId={dataTestIds.scheduleInPersonVisitButton}
            />
            <HomepageOption
              title="Start a Virtual Visit"
              icon={<VideoCameraFrontOutlinedIcon />}
              handleClick={handleRequestVisit}
              dataTestId={dataTestIds.startVirtualVisitButton}
            />

            <HomepageOption
              title="Start an In-Person Visit"
              icon={<LocalHospitalOutlinedIcon />}
              handleClick={handleWalkIn}
              dataTestId={dataTestIds.startInPersonVisitButton}
            />
            <HomepageOption
              title="Past Visits"
              icon={pastVisits}
              handleClick={handlePastVisits}
              subtitle="School/Work Notes and Prescriptions"
              dataTestId={dataTestIds.navigatePastVisitsButton}
            />
          </Box>
        )}

        <HomepageOption
          title="Contact Support"
          icon={<LiveHelpOutlinedIcon />}
          handleClick={handleContactSupport}
          dataTestId={dataTestIds.contactSupportButton}
        />
      </Box>
      {isCancelVisitDialogOpen ? (
        <CancelVisitDialog
          appointmentID={appointmentID}
          onClose={(canceled) => {
            setCancelVisitDialogOpen(false);
            if (canceled) void refetchAppointments();
          }}
        />
      ) : null}
    </CustomContainer>
  );
};

export default Homepage;
