import { Box, Button, Skeleton, Typography } from '@mui/material';
import { generatePath, useNavigate, useParams } from 'react-router-dom';
import { VitalsOverTime } from 'src/features/past-visits/components/VitalsOverTime';
import { useGetPastVisits } from 'src/features/past-visits/past-visits.queries';
import { useOystehrAPIClient } from 'src/telemed/utils/getOystehrAPI';
import { formatVisitDate } from 'utils/lib/utils/date';
import { intakeFlowPageRoute } from '../App';
import { otherColors } from '../IntakeThemeProvider';

const PastVisits = (): JSX.Element => {
  const apiClient = useOystehrAPIClient();
  const { patientId } = useParams();
  const navigate = useNavigate();

  const { data: pastVisitsData, isFetching } = useGetPastVisits(
    apiClient,
    Boolean(apiClient) && Boolean(patientId),
    patientId ?? ''
  );

  const pastAppointments = pastVisitsData?.appointments;
  const pastVitals = pastVisitsData?.vitals;

  const handleVisitDetails = (visitId: string): void => {
    if (!visitId || !patientId) {
      return;
    }
    const destination = generatePath(intakeFlowPageRoute.VisitDetails.path, {
      patientId,
      visitId,
    });
    navigate(destination);
  };

  return (
    <Box>
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
          {pastVitals && pastVitals.length > 0 && (
            <>
              <VitalsOverTime vitals={pastVitals} onSelectVisit={handleVisitDetails} />
              <Typography variant="h3" color="primary.main">
                Visit history
              </Typography>
            </>
          )}
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
                    onClick={() => handleVisitDetails(appointment.id)}
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
    </Box>
  );
};

export default PastVisits;
