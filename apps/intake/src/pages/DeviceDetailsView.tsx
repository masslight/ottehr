import InfoIcon from '@mui/icons-material/Info';
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined';
import TimelineIcon from '@mui/icons-material/Timeline';
import { Box, Divider, Paper, Tab, Tabs, Typography } from '@mui/material';
import { useState } from 'react';
import { useQuery } from 'react-query';
import { useLocation, useParams } from 'react-router-dom';
import { ottehrApi } from 'src/api';
import { useUCZambdaClient } from 'src/hooks/useUCZambdaClient';
import { CustomContainer } from '../telemed/features/common';
import { PatientDeviceVitalsTable } from './PatientDeviceVitalsTable';

interface Device {
  id: string;
  resourceType: string;
  name: string;
  manufacturer?: string;
  versionId: string;
  lastUpdated: string;
}

interface VitalsData {
  message: string;
  vitals: Array<{
    valueString?: string;
    valueInteger?: number;
    code: {
      text: string;
    };
  }>;
  total: number;
}

const DeviceDetailsView = (): JSX.Element => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const location = useLocation();
  const [tabValue, setTabValue] = useState(0);
  const [vitalsData, setVitalsData] = useState<VitalsData | null>(null);
  const tokenfulZambdaClient = useUCZambdaClient({ tokenless: false });

  const device: Device = location.state?.device || {
    id: deviceId || '',
    resourceType: 'Device',
    name: 'Unknown Model',
    versionId: '',
    lastUpdated: '',
    manufacturer: 'Unknown Company',
  };

  console.log('Im here');
  const payload = {
    deviceId: device.id,
  };

  const { isLoading: isVitalsLoading, error: vitalsError } = useQuery(
    ['getPatientsDeviceVitals', { zambdaClient: tokenfulZambdaClient }],
    () => (tokenfulZambdaClient ? ottehrApi.getPatientsDeviceVitals(tokenfulZambdaClient, payload) : null),
    {
      onSuccess: (data: VitalsData | null) => {
        if (data) {
          setVitalsData(data);
        }
      },
      onError: (error: unknown) => {
        console.error('Failed to fetch device vitals:', error);
      },
      enabled: Boolean(tokenfulZambdaClient),
    }
  );

  const deviceName = device?.name || 'Unknown Device';

  return (
    <CustomContainer title="Device Details" description="" isFirstPage={false}>
      <Box sx={{ width: '100%', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <MedicalServicesOutlinedIcon fontSize="large" color="primary" />
          <Box>
            <Typography variant="h5">{deviceName}</Typography>
            <Typography variant="body2" sx={{ fontSize: '0.8rem' }} color="text.secondary">
              Device ID: {device.id}
            </Typography>
          </Box>
        </Box>
        <Divider sx={{ my: 2 }} />
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Device Info" icon={<InfoIcon />} />
          <Tab label="Vitals" icon={<TimelineIcon />} />
        </Tabs>
        <Paper sx={{ p: 3, mt: 2 }}>
          {tabValue === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Device Specifications
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                <Box>
                  <Typography variant="subtitle2">Manufacturer</Typography>
                  <Typography>{device.manufacturer || 'Unknown Company'}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">Version ID</Typography>
                  <Typography>{device.versionId || 'Unknown VersionId'}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">Last Updated</Typography>
                  <Typography>{device.lastUpdated || '15/08/2025'}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">Resource Type</Typography>
                  <Typography>{device.resourceType || 'Device'}</Typography>
                </Box>
              </Box>
            </Box>
          )}
          {tabValue === 1 && (
            <>
              {isVitalsLoading && <Typography variant="body1">Loading vitals data...</Typography>}
              {vitalsData && (
                <PatientDeviceVitalsTable vitalsData={vitalsData} deviceId={deviceId || ''} loading={isVitalsLoading} />
              )}
              {!isVitalsLoading && !vitalsData && !vitalsError && (
                <Typography variant="body1">No vitals data available</Typography>
              )}
            </>
          )}
        </Paper>
      </Box>
    </CustomContainer>
  );
};

export default DeviceDetailsView;
