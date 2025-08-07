import InfoIcon from '@mui/icons-material/Info';
import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined';
import TimelineIcon from '@mui/icons-material/Timeline';
import { Box, Paper, Tab, Tabs, Typography } from '@mui/material';
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import HomepageOption from '../components/HomepageOption';
import { CustomContainer } from '../telemed/features/common';

interface DeviceReading {
  type: string;
  value: string;
  date: string;
}

interface Device {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  lastConnected: string;
  readings: DeviceReading[];
}

const DevicesPage = (): JSX.Element => {
  const navigate = useNavigate();
  const { deviceId } = useParams();
  const [tabValue, setTabValue] = useState(0);

  // Sample data - replace with your API data
  const devices: Device[] = [
    {
      id: 'BG-12345',
      name: 'Blood Glucose Meter',
      manufacturer: 'Acme Medical',
      model: 'GlucoCheck Pro',
      lastConnected: '2023-06-15 10:30 AM',
      readings: [
        { type: 'Glucose Level', value: '98 mg/dL', date: '2023-06-15 10:28 AM' },
        { type: 'Glucose Level', value: '102 mg/dL', date: '2023-06-14 08:15 PM' },
      ],
    },
    {
      id: 'WS-67890',
      name: 'Weight Scale',
      manufacturer: 'HealthTrack',
      model: 'Balance+ 2023',
      lastConnected: '2023-06-14 09:15 AM',
      readings: [
        { type: 'Weight', value: '72.5 kg', date: '2023-06-14 09:12 AM' },
        { type: 'BMI', value: '23.1', date: '2023-06-14 09:12 AM' },
      ],
    },
  ];

  if (deviceId) {
    const device = devices.find((d) => d.id === deviceId);
    if (device) {
      return (
        <CustomContainer title="Device Details" description="" isFirstPage={false}>
          <Box sx={{ width: '100%' }}>
            <Typography variant="h5" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <MonitorHeartOutlinedIcon fontSize="large" color="primary" />
              {device.name}
            </Typography>

            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
              <Tab label="Device Info" icon={<InfoIcon />} />
              <Tab label="Vitals" icon={<TimelineIcon />} />
            </Tabs>

            <Paper sx={{ p: 3, mt: 2 }}>
              {tabValue === 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Device Information
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <div>
                      <Typography variant="subtitle2">Device ID</Typography>
                      <Typography>{device.id}</Typography>
                    </div>
                    <div>
                      <Typography variant="subtitle2">Manufacturer</Typography>
                      <Typography>{device.manufacturer}</Typography>
                    </div>
                    <div>
                      <Typography variant="subtitle2">Model</Typography>
                      <Typography>{device.model}</Typography>
                    </div>
                    <div>
                      <Typography variant="subtitle2">Last Connected</Typography>
                      <Typography>{device.lastConnected}</Typography>
                    </div>
                  </Box>
                </Box>
              )}

              {tabValue === 1 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Recent Readings
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    {device.readings.map((reading, index) => (
                      <Paper key={index} sx={{ p: 2 }}>
                        <Typography variant="subtitle2">{reading.type}</Typography>
                        <Typography variant="h5">{reading.value}</Typography>
                        <Typography variant="caption">{reading.date}</Typography>
                      </Paper>
                    ))}
                  </Box>
                </Box>
              )}
            </Paper>
          </Box>
        </CustomContainer>
      );
    }
  }

  return (
    <CustomContainer title="My Devices" description="" isFirstPage={true}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {devices.map((device) => (
          <HomepageOption
            key={device.id}
            title={device.name}
            icon={<MonitorHeartOutlinedIcon />}
            handleClick={() => navigate(`/devices/${device.id}`)}
          />
        ))}
      </Box>
    </CustomContainer>
  );
};

export default DevicesPage;
