import { Box, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { useParams } from 'react-router-dom';
import { ActionLogsTabs } from 'src/features/action-logs/ActionLogsTabs';
import { Header } from 'src/features/visits/shared/components/patient/Header';
import { getFullName } from 'utils/lib/fhir/patient';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import { LoadingScreen } from '../components/LoadingScreen';
import { useGetPatient } from '../hooks/useGetPatient';
import { useNavigateBack } from '../hooks/useNavigateBack';

const PatientActionLogsPage: FC = () => {
  const theme = useTheme();
  const { id: patientId } = useParams();
  const navigateBack = useNavigateBack(`/patient/${patientId}`);

  const { patient, loading: isLoadingPatientData } = useGetPatient(patientId);
  if (isLoadingPatientData) return <LoadingScreen />;

  return (
    <Box>
      <Header handleDiscard={navigateBack} id={patientId} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, padding: theme.spacing(3) }}>
        <CustomBreadcrumbs
          chain={[
            { link: '/patients', children: 'Patients' },
            {
              link: `/patient/${patientId}`,
              children: patient ? getFullName(patient) : '',
            },
            {
              link: '#',
              children: 'Action Logs',
            },
          ]}
        />
        <Typography variant="h3" color="primary.main">
          Action Logs
        </Typography>
        <ActionLogsTabs patientId={patientId} />
      </Box>
    </Box>
  );
};

export default PatientActionLogsPage;
