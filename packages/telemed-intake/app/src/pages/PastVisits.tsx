import { Box, Button, Skeleton, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { IntakeFlowPageRoute } from '../App';
import { CustomContainer } from '../features/common';
import { useGetAppointments, usePastVisitsStore } from '../features/appointments';
import { useZapEHRAPIClient } from '../utils';
import { usePatientInfoStore } from '../features/patient-info';
import { TelemedAppointmentInformation } from 'ottehr-utils';
import { otherColors } from '../IntakeThemeProvider';
import { useNavigate } from 'react-router-dom';
import { formatVisitDate } from 'ottehr-utils';

const PastVisits = (): JSX.Element => {
  const apiClient = useZapEHRAPIClient();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { patientInfo: currentPatientInfo } = usePatientInfoStore.getState();
  const patientFullName = currentPatientInfo ? `${currentPatientInfo.firstName} ${currentPatientInfo.lastName}` : '';
  const formattedPatientBirthDay = formatVisitDate(currentPatientInfo.dateOfBirth || '', 'birth');

  const { data: appointmentsData, isFetching } = useGetAppointments(
    apiClient,
    Boolean(apiClient) && Boolean(currentPatientInfo?.id),
    currentPatientInfo?.id,
  );

  const pastAppointments = appointmentsData?.appointments.filter(
    (appointment) =>
      appointment.telemedStatus === 'complete' ||
      appointment.telemedStatus === 'unsigned' ||
      appointment.telemedStatus === 'cancelled',
  );
  const handleVisitDetails = (appointment: TelemedAppointmentInformation): void => {
    usePastVisitsStore.setState({
      appointmentID: appointment.id,
      appointmentDate: formatVisitDate(appointment.start || '', 'visit'),
    });
    navigate(`${IntakeFlowPageRoute.VisitDetails.path}?id=${appointment.id}`);
  };
  return (
    <CustomContainer
      title={patientFullName}
      subtext={t('general.patientBirthday', { formattedPatientBirthDay })}
      description=""
      bgVariant={IntakeFlowPageRoute.PatientPortal.path}
      isFirstPage={true}
    >
      <Typography variant="h2" color="primary.main">
        {t('pastVisits.visits')}
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
      {!isFetching &&
        pastAppointments?.map((appointment) => {
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
                backgroundColor: otherColors.lightPurple,
                cursor: appointment.appointmentStatus === 'cancelled' ? 'auto' : 'pointer',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column ', alignItems: 'flex-start', gap: 1 }}>
                  <Typography variant="subtitle1" color={otherColors.brightPurple}>
                    {formatVisitDate(appointment.start || '', 'visit')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {appointment.id}
                  </Typography>
                  {appointment.appointmentStatus === 'cancelled' && (
                    <Typography
                      variant="overline"
                      color="text.secondary"
                      sx={{ backgroundColor: 'background.cancelled', color: 'text.cancelled', borderRadius: 1, px: 1 }}
                    >
                      {t('general.button.cancelled')}
                    </Typography>
                  )}
                </Box>
              </Box>
              {appointment.appointmentStatus !== 'cancelled' && (
                <Button
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: otherColors.white,
                    color: 'primary.main',
                    border: '1px solid',
                    borderColor: otherColors.purple,
                    borderRadius: '100px',
                    py: 1,
                    px: 2,
                  }}
                  onClick={() => handleVisitDetails(appointment)}
                >
                  {t('pastVisits.visitDetails')}
                </Button>
              )}
            </Box>
          );
        })}
      <Button
        sx={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: otherColors.white,
          color: 'primary.main',
          border: '1px solid',
          borderColor: otherColors.purple,
          borderRadius: '100px',
          py: 1,
          px: 2,
          mt: 2,
        }}
        onClick={() => {
          navigate(IntakeFlowPageRoute.PatientPortal.path);
        }}
      >
        {t('pastVisits.backToHome')}
      </Button>
    </CustomContainer>
  );
};

export default PastVisits;
