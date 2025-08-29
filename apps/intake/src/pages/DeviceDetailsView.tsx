import InfoIcon from '@mui/icons-material/Info';
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined';
import TimelineIcon from '@mui/icons-material/Timeline';
import { Box, Divider, Paper, Tab, Tabs, Typography } from '@mui/material';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CustomContainer } from '../telemed/features/common';
import { PatientDeviceVitalsTable } from './PatientDeviceVitalsTable';

interface Device {
  id: string;
  resourceType: string;
  name: string;
  manufacturer?: string;
  versionId: string;
  lastUpdated: string;
  distinctIdentifier: string;
  serialNumber: string;
  modelNumber: string;
  hardwareVersion: string;
  modemVersion: string;
  firmwareVersion: string;
}

const DeviceDetailsView = (): JSX.Element => {
  const location = useLocation();
  const [tabValue, setTabValue] = useState(0);

  const device: Device = location.state?.device || {
    id: '',
    resourceType: 'Device',
    name: 'Unknown Device',
    versionId: '',
    lastUpdated: '',
    manufacturer: '',
    distinctIdentifier: '',
    serialNumber: '',
    modelNumber: '',
    hardwareVersion: '',
    modemVersion: '',
    firmwareVersion: '',
  };

  const deviceName = device?.name || 'Unknown Device';
  const deviceTypeMap: Record<string, string> = {
    BP: 'Blood Pressure Monitor',
    BG: 'Blood Glucose Monitor',
    WS: 'Weight Scale',
  };

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
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                <Box>
                  <Typography variant="subtitle2">Device Type</Typography>
                  <Typography>
                    {device?.distinctIdentifier
                      ? deviceTypeMap[device?.distinctIdentifier] || (device?.distinctIdentifier ?? '-')
                      : '-'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">Serial Number</Typography>
                  <Typography>{device?.serialNumber ?? '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">Model Number</Typography>
                  <Typography>{device?.modelNumber ?? '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">Manufacturer</Typography>
                  <Typography>{device.manufacturer || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">Hardware Version</Typography>
                  <Typography>{device.hardwareVersion || ''}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">Firmware Version</Typography>
                  <Typography>{device.firmwareVersion || ''}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">Modem Version</Typography>
                  <Typography>{device.modemVersion || ''}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">Last Updated</Typography>
                  <Typography>{device.lastUpdated || '-'}</Typography>
                </Box>
              </Box>
            </Box>
          )}
          {tabValue === 1 && (
            <PatientDeviceVitalsTable deviceType={device?.distinctIdentifier} deviceId={device.id || ''} />
          )}
        </Paper>
      </Box>
    </CustomContainer>
  );
};

export default DeviceDetailsView;
