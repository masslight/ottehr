import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Tab, Typography, useTheme } from '@mui/material';
import { FC, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaxLogsTable } from 'src/features/fax-logs/FaxLogsTable';
import { Header } from 'src/features/visits/shared/components/patient/Header';
import { getFullName } from 'utils';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import { LoadingScreen } from '../components/LoadingScreen';
import { useGetPatient } from '../hooks/useGetPatient';

const PatientActionLogsPage: FC = () => {
  const theme = useTheme();
  const { id: patientId } = useParams();
  const navigate = useNavigate();

  const { patient, loading: isLoadingPatientData } = useGetPatient(patientId);
  // Fax logs are the only action log so far; future log types become additional tabs.
  const [tab, setTab] = useState('fax-logs');

  if (isLoadingPatientData) return <LoadingScreen />;

  return (
    <Box>
      <Header handleDiscard={() => navigate(-1)} id={patientId} />
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
        <TabContext value={tab}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <TabList onChange={(_, newTab) => setTab(newTab)}>
              <Tab
                value="fax-logs"
                label={
                  <Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>Fax Logs</Typography>
                }
              />
            </TabList>
          </Box>
          <TabPanel value="fax-logs" sx={{ p: 0 }}>
            <FaxLogsTable patientId={patientId} />
          </TabPanel>
        </TabContext>
      </Box>
    </Box>
  );
};

export default PatientActionLogsPage;
