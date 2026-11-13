import { Box, Paper, Typography, useTheme } from '@mui/material';
import { FC, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { PatientDocumentsExplorer } from 'src/features/visits/shared/components/patient/docs/PatientDocumentsExplorer';
import { Header } from 'src/features/visits/shared/components/patient/Header';
import { getFullName } from 'utils/lib/fhir/patient';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import { LoadingScreen } from '../components/LoadingScreen';
import { useGetPatient } from '../hooks/useGetPatient';
import { useNavigateBack } from '../hooks/useNavigateBack';
import { usePatientStore } from '../state/patient.store';

const PatientDocumentsExplorerPage: FC = () => {
  const theme = useTheme();

  const { id: patientId } = useParams();
  const navigateBack = useNavigateBack(`/patient/${patientId}`);
  const [searchParams] = useSearchParams();
  const initialFolderName = searchParams.get('folder') || undefined;
  const initialFolderId = searchParams.get('folderId') || undefined;

  const { patient, loading: isLoadingPatientData } = useGetPatient(patientId);
  useEffect(() => {
    if (!patient) return;
    usePatientStore.setState({
      patient: patient,
    });
  }, [patient]);

  if (isLoadingPatientData) return <LoadingScreen />;

  return (
    <Box>
      <Header handleDiscard={navigateBack} id={patientId} />
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
                children: 'Patient Profile',
              },
            ]}
          />
          <Typography variant="subtitle1" color="primary.main">
            Docs
          </Typography>

          <Paper sx={{ padding: 3 }}>
            <PatientDocumentsExplorer
              patientId={patientId!}
              patient={patient}
              initialFolderName={initialFolderName}
              initialFolderId={initialFolderId}
            />
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default PatientDocumentsExplorerPage;
