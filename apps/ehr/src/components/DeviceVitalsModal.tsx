import CloseIcon from '@mui/icons-material/Close';
import { Box, Dialog, DialogContent, IconButton, Paper, Tab, Tabs, Typography } from '@mui/material';
import React, { useState } from 'react';
import { DeviceVitalsTable } from './DeviceVitalsTable';

interface DeviceVitalsModalProps {
  open: boolean;
  onClose: () => void;
  devices: any[];
  deviceType: string;
  patientId: string;
}

export const DeviceVitalsModal: React.FC<DeviceVitalsModalProps> = ({
  open,
  onClose,
  devices,
  deviceType,
  patientId,
}) => {
  const [selectedTab, setSelectedTab] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number): void => {
    setSelectedTab(newValue);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 4,
          minHeight: '55vh',
          maxHeight: '70vh',
          boxShadow: '0px 6px 20px rgba(0,0,0,0.15)',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h4" color="primary.dark" sx={{ flexGrow: 1 }}>
            Device Vitals
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mx: 3 }}>
        <Tabs
          value={selectedTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          textColor="primary"
          indicatorColor="primary"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 500,
              borderRadius: 2,
              minHeight: 40,
              px: 2.5,
              mr: 1,
            },
          }}
        >
          {devices.map((device, index) => (
            <Tab key={device.id} label={device.name || `Device ${index + 1}`} />
          ))}
        </Tabs>
      </Box>

      <DialogContent sx={{ p: 3, bgcolor: '#fff' }}>
        {devices.length > 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: 0,
              bgcolor: 'white',
              height: '100%',
            }}
          >
            <DeviceVitalsTable
              name={devices[selectedTab].name}
              deviceType={deviceType}
              patientId={patientId}
              deviceId={devices[selectedTab].id}
              onBack={onClose}
              isModal={true}
            />
          </Paper>
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '40vh',
              color: 'text.secondary',
            }}
          >
            <Typography>No devices found</Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};
