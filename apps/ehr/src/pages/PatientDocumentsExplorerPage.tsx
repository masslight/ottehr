import { Box, Paper, Typography, useTheme } from '@mui/material';
import { FC, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PatientDocumentsExplorer } from 'src/features/visits/shared/components/patient/docs/PatientDocumentsExplorer';
import { Header } from 'src/features/visits/shared/components/patient/Header';
import { getFullName } from 'utils/lib/fhir/patient';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import { LoadingScreen } from '../components/LoadingScreen';
import { useGetPatient } from '../hooks/useGetPatient';
import { usePatientStore } from '../state/patient.store';

const PatientDocumentsExplorerPage: FC = () => {
  const theme = useTheme();

  const { id: patientId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFolderName = searchParams.get('folder') || undefined;

  const { patient, loading: isLoadingPatientData } = useGetPatient(patientId);
  useEffect(() => {
    if (!patient) return;
    usePatientStore.setState({
      patient: patient,
    });
  }, [patient]);

  const handleBackClickWithConfirmation = (): void => {
    navigate(-1);
  };

  if (isLoadingPatientData) return <LoadingScreen />;

  return (
    <Box>
      <Header handleDiscard={handleBackClickWithConfirmation} id={patientId} />
      <Box sx={{ display: 'flex', flexDirection: 'column', padding: theme.spacing(3) }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <CustomBreadcrumbs
            chain={[
              { link: '/patients', children: 'Patients' },
              {
                link: `/patient/${patient?.id}`,
                children: patient ? getFullName(patient) : '',
              },
              {
                link: '#',
                children: `Patient Profile`,
              },
            ]}
          />
          <Typography variant="subtitle1" color="primary.main">
            Docs
          </Typography>

          <Paper sx={{ padding: 3 }}>
            <PatientDocumentsExplorer patientId={patientId!} initialFolderName={initialFolderName} />
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default PatientDocumentsExplorerPage;
