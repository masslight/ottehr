import { Button, Typography } from '@mui/material';
import { IntakeFlowPageRoute } from '../App';
import { CustomContainer } from '../features/common';
import { usePastVisitsStore } from '../features/appointments';
import { usePatientInfoStore } from '../features/patient-info';
import { otherColors } from '../IntakeThemeProvider';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatVisitDate } from 'ottehr-utils';

const VisitDetails = (): JSX.Element => {
  const navigate = useNavigate();
  const { patientInfo: currentPatientInfo } = usePatientInfoStore.getState();
  const appointment = usePastVisitsStore.getState();
  const patientFullName = currentPatientInfo ? `${currentPatientInfo.firstName} ${currentPatientInfo.lastName}` : '';
  const formattedPatientBirthDay = formatVisitDate(currentPatientInfo.dateOfBirth || '', 'birth');
  const { t } = useTranslation();

  return (
    <CustomContainer
      title={patientFullName}
      subtext={t('general.patientBirthday', { formattedPatientBirthDay })}
      description=""
      bgVariant={IntakeFlowPageRoute.PatientPortal.path}
      isFirstPage={true}
    >
      <Typography variant="h2" color="primary.main" sx={{ mb: 2 }}>
        {appointment.appointmentDate}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {t('visitDetails.visitId', { visitId: appointment.appointmentID })}
      </Typography>
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
          navigate(IntakeFlowPageRoute.PastVisits.path);
        }}
      >
        {t('visitDetails.backToVisitsList')}
      </Button>
    </CustomContainer>
  );
};

export default VisitDetails;
