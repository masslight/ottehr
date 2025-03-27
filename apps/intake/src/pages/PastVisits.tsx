import { Box, Button, Skeleton, Typography } from '@mui/material';
import { intakeFlowPageRoute } from '../App';
import { CustomContainer } from '../telemed/features/common';
import { useGetPastVisits, usePastVisitsStore } from '../features/past-visits';
import { useZapEHRAPIClient } from '../telemed/utils';
import { usePatientInfoStore } from '../telemed/features/patient-info';
import { AppointmentInformationIntake, getPatientInfoFullNameUsingChosen } from 'utils';
import { otherColors } from '../IntakeThemeProvider';
import { useNavigate } from 'react-router-dom';
import { formatVisitDate } from 'utils';

const PastVisits = (): JSX.Element => {
  const apiClient = useZapEHRAPIClient();
  const navigate = useNavigate();
  const { patientInfo: currentPatientInfo } = usePatientInfoStore.getState();
  const patientFullName = currentPatientInfo ? getPatientInfoFullNameUsingChosen(currentPatientInfo) : '';
  const formattedPatientBirthDay = formatVisitDate(currentPatientInfo.dateOfBirth || '', 'birth');

  const { data: pastVisitsData, isFetching } = useGetPastVisits(
    apiClient,
    Boolean(apiClient) && Boolean(currentPatientInfo?.id),
    currentPatientInfo?.id
  );

  const pastAppointments = pastVisitsData?.appointments;

  const handleVisitDetails = (appointment: AppointmentInformationIntake): void => {
    usePastVisitsStore.setState({
      appointmentID: appointment.id,
      appointmentDate: formatVisitDate(appointment.start || '', 'visit', appointment.timezone),
    });
    navigate(`${intakeFlowPageRoute.VisitDetails.path}?id=${appointment.id}`);
  };

  return (
    <CustomContainer
      title={patientFullName}
      subtext={`Birthday: ${formattedPatientBirthDay}`}
      description=""
      isFirstPage={true}
    >
      <Typography variant="h2" color="primary.main" sx={{ mb: 2 }}>
        Visits
      </Typography>

      {isFetching && (
        <Skeleton
          sx={{
            borderRadius: 2,
            backgroundColor: otherColors.coachingVisit,
            p: 8,
          }}
        />
      )}
      {!isFetching && (
        <>
          {!pastAppointments ||
            (pastAppointments?.length < 1 && (
              <Typography variant="caption" data-testid="empty-state-message">
                There are no past visits.
              </Typography>
            ))}
          {pastAppointments?.map((appointment) => {
            return (
              <Box
                key={appointment.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: 2,
                  px: 3,
                  py: 3,
                  my: 3,
                  gap: 2,
                  backgroundColor: otherColors.lightPurple,
                  cursor: appointment.appointmentStatus === 'cancelled' ? 'auto' : 'pointer',
                }}
                data-testid="past-visits-list"
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column ', alignItems: 'flex-start', gap: 1 }}>
                    <Typography variant="subtitle1" color={otherColors.darkPurple}>
                      {formatVisitDate(appointment.start || '', 'visit', appointment.timezone)}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ lineBreak: 'anywhere', flexGrow: 1 }}>
                        {`Visit ID: ${appointment.id}`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {`(${appointment.type})`}
                      </Typography>
                    </Box>
                    {appointment.appointmentStatus === 'cancelled' && (
                      <Typography
                        variant="overline"
                        color="text.secondary"
                        sx={{
                          backgroundColor: 'background.cancelled',
                          color: 'text.cancelled',
                          borderRadius: 1,
                          px: 1,
                        }}
                      >
                        Canceled
                      </Typography>
                    )}
                  </Box>
                </Box>
                {appointment.appointmentStatus !== 'cancelled' && (
                  <Button
                    sx={{
                      flex: '1 0 131px',
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: otherColors.white,
                      color: 'primary.light',
                      border: '1px solid',
                      borderColor: otherColors.purple,
                      borderRadius: '100px',
                      py: 1,
                      px: 2,
                    }}
                    onClick={() => handleVisitDetails(appointment)}
                  >
                    View Details
                  </Button>
                )}
              </Box>
            );
          })}
        </>
      )}
      <Button
        data-testid="back-to-homepage-button"
        sx={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: otherColors.white,
          color: 'primary.light',
          border: '1px solid',
          borderColor: otherColors.purple,
          borderRadius: '100px',
          py: 1,
          px: 2,
          mt: 2,
        }}
        onClick={() => {
          navigate(intakeFlowPageRoute.Homepage.path);
        }}
      >
        Back to homepage
      </Button>
    </CustomContainer>
  );
};

export default PastVisits;
