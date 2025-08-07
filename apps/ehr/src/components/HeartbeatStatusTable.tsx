import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, Button, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDate } from 'utils';
import CustomBreadcrumbs from './CustomBreadcrumbs';

interface HeartbeatStatusProps {
  status: {
    data_type: string;
    imei: string;
    imsi: string;
    iccid: string;
    sig: number;
    apn: string;
    bat: number;
    tz: number;
    kernel_ver: string;
    app_ver: string;
    mcuv: string;
    uptime: number;
  };
  deviceId: string;
  createdAt: number;
  isTest?: boolean;
  modelNumber?: string;
  loading?: boolean;
  firstName?: string;
  lastName?: string;
}

export const HeartbeatStatusTable: React.FC<HeartbeatStatusProps> = ({ loading }) => {
  const navigate = useNavigate();

  // Prepare data in { id, field, value } format for DataGridPro
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

  return (
    <Paper sx={{ padding: 10, width: '100%', marginInline: 'auto' }} component={Stack} spacing={2}>
      {/* Header Section */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: 5 }}>
          <Typography variant="h3" color="primary.dark" sx={{ flexGrow: 1 }}>
            Deep, Johnny
          </Typography>
          <CustomBreadcrumbs
            chain={[
              {
                link: '#',
                children: (
                  <span onClick={() => navigate(-1)} style={{ cursor: 'pointer' }}>
                    Devices
                  </span>
                ),
              },
              {
                link: '#',
                children: loading ? (
                  <Skeleton width={150} />
                ) : (
                  <>
                    <Typography component="span" sx={{ fontWeight: 500 }}>
                      {'Blood Glucose Meter'}
                    </Typography>
                  </>
                ),
              },
            ]}
          />
        </Box>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ marginBottom: '10' }}
        >
          Back
        </Button>
      </Box>

      {/* DataGridPro Section */}
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
    </Paper>
  );
};
