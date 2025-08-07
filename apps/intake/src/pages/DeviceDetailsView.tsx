import InfoIcon from '@mui/icons-material/Info';
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined';
import TimelineIcon from '@mui/icons-material/Timeline';
import { Box, Chip, Divider, Paper, Tab, Tabs, Typography } from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { formatDate } from 'utils';
import { CustomContainer } from '../telemed/features/common';

interface DeviceReading {
  type: string;
  value: string;
  date: string;
  status?: 'normal' | 'abnormal';
}

interface Device {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  lastConnected: string;
  status: 'active' | 'inactive' | 'needs_attention';
  readings: DeviceReading[];
}

const DeviceDetailsView = (): JSX.Element => {
  const { deviceId } = useParams();
  const [tabValue, setTabValue] = useState(0);

  // Mock data - replace with your API call
  const device: Device = {
    id: deviceId || 'BG-12345',
    name: 'Blood Glucose Meter',
    manufacturer: 'Dexcom',
    model: 'G6 Pro',
    lastConnected: '04/10/2025 15:30',
    status: 'active',
    readings: [
      { type: 'Glucose', value: '98 mg/dL', date: '04/10/2025 15:28', status: 'normal' },
      { type: 'Glucose', value: '102 mg/dL', date: '04/10/2025 10:15', status: 'normal' },
      { type: 'Glucose', value: '145 mg/dL', date: '04/09/2025 18:30', status: 'abnormal' },
      { type: 'Glucose', value: '112 mg/dL', date: '04/09/2025 12:45', status: 'normal' },
    ],
  };

  const rows = [
    {
      id: 1,
      timePeriod: '1  Month',
      createdAt: formatDate('2024-08-01'),
      data_type: 'bgm_gen1_heartbeat',
      imei: '864475040090333',
      imsi: '460081948308296',
      iccid: '89860499102170308296f',
      sig: 16,
      apn: 'hologram',
      bat: '60%',
      tz: 8,
      kernel_ver: 'BG95M3LAR02A03_BETA0614',
      app_ver: '0.1.0',
      mcuv: 'SW2071238011A001',
      isTest: 'No',
      modelNumber: 'N/A',
    },
    {
      id: 2,
      timePeriod: '2 Months',
      createdAt: formatDate('2024-08-02'),
      data_type: 'bgm_gen2_heartbeat',
      imei: '864475040090444',
      imsi: '460081948308123',
      iccid: '89860499102170301234f',
      sig: 15,
      apn: 'hologram',
      bat: '70%',
      tz: 5,
      kernel_ver: 'BG96X1LAR02A03_BETA0614',
      app_ver: '1.0.1',
      mcuv: 'SW2071238011A002',
      isTest: 'Yes',
      modelNumber: 'X1000',
    },
  ];

  const columns: GridColDef[] = [
    { field: 'timePeriod', headerName: 'Time Period', width: 150 },
    { field: 'createdAt', headerName: 'Created At', width: 150 },
    { field: 'data_type', headerName: 'Data Type', width: 150 },
    { field: 'imei', headerName: 'IMEI', width: 150 },
    { field: 'imsi', headerName: 'IMSI', width: 150 },
    { field: 'iccid', headerName: 'ICCID', width: 150 },
    { field: 'sig', headerName: 'Signal Strength', width: 150 },
    { field: 'bat', headerName: 'Battery', width: 150 },
    { field: 'tz', headerName: 'Timezone', width: 150 },
    { field: 'modelNumber', headerName: 'Model Number', width: 150 },
  ];

  const getStatusColor = (status: string): 'success' | 'warning' | 'default' | 'error' => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      case 'needs_attention':
        return 'warning';
      case 'abnormal':
        return 'error';
      default:
        return 'success';
    }
  };

  return (
    <CustomContainer title="Patient Devices" description="" isFirstPage={false}>
      <Box sx={{ width: '100%', mb: 3 }}>
        {/* Header similar to the patient record in your image */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <MedicalServicesOutlinedIcon fontSize="large" color="primary" />
          <Box>
            <Typography variant="h5">{device.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              Device ID: {device.id}
            </Typography>
          </Box>
          <Chip
            label={device.status.replace('_', ' ')}
            color={getStatusColor(device.status)}
            sx={{ textTransform: 'capitalize', ml: 'auto' }}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Tabs */}
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Device Info" icon={<InfoIcon />} />
          <Tab label="Vitals" icon={<TimelineIcon />} />
        </Tabs>

        {/* Tab Content */}
        <Paper sx={{ p: 3, mt: 2 }}>
          {tabValue === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Device Specifications
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                <Box>
                  <Typography variant="subtitle2">Manufacturer</Typography>
                  <Typography>{device.manufacturer}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">Model</Typography>
                  <Typography>{device.model}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">Last Connected</Typography>
                  <Typography>{device.lastConnected}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">Connection Status</Typography>
                  <Chip
                    label={device.status.replace('_', ' ')}
                    color={getStatusColor(device.status)}
                    size="small"
                    sx={{ textTransform: 'capitalize' }}
                  />
                </Box>
              </Box>
            </Box>
          )}

          {tabValue === 1 && (
            // <Box>
            //     <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>Vital Readings</Typography>

            //     {/* Table-like structure similar to your encounters table */}
            //     <Box sx={{ overflow: 'auto' }}>
            //         <Box sx={{
            //             display: 'grid',
            //             gridTemplateColumns: '1fr 1fr 1fr 1fr',
            //             borderBottom: '1px solid #e0e0e0',
            //             py: 1,
            //             fontWeight: 'bold'
            //         }}>
            //             <Typography variant="subtitle2">Date & Time</Typography>
            //             <Typography variant="subtitle2">Type</Typography>
            //             <Typography variant="subtitle2">Value</Typography>
            //             <Typography variant="subtitle2">Status</Typography>
            //         </Box>

            //         {device.readings.map((reading, index) => (
            //             <Box
            //                 key={index}
            //                 sx={{
            //                     display: 'grid',
            //                     gridTemplateColumns: '1fr 1fr 1fr 1fr',
            //                     borderBottom: '1px solid #f5f5f5',
            //                     py: 2,
            //                     alignItems: 'center'
            //                 }}
            //             >
            //                 <Typography>{reading.date}</Typography>
            //                 <Typography>{reading.type}</Typography>
            //                 <Typography variant="body1" fontWeight="medium">
            //                     {reading.value}
            //                 </Typography>
            //                 <Chip
            //                     label={reading.status || 'normal'}
            //                     color={getStatusColor(reading.status || 'normal')}
            //                     size="small"
            //                     sx={{ textTransform: 'capitalize', width: '80px' }}
            //                 />
            //             </Box>
            //         ))}
            //     </Box>
            // </Box>
            <DataGridPro
              rows={rows}
              columns={columns}
              autoHeight
              hideFooter
              disableColumnMenu
              disableRowSelectionOnClick
              sx={{
                width: '100%',
                border: 0,
                overflowX: 'auto',
                '.MuiDataGrid-columnHeaderTitle': {
                  fontWeight: 500,
                  whiteSpace: 'normal',
                  lineHeight: 1.2,
                },
                '.MuiDataGrid-cell': {
                  whiteSpace: 'normal',
                  lineHeight: 1.4,
                },
              }}
            />
          )}
        </Paper>
      </Box>
    </CustomContainer>
  );
};

export default DeviceDetailsView;
