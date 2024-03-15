import React, { FC, useState } from 'react';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Tab, Typography } from '@mui/material';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import { ContractEditIcon, DiagnosisIcon, PatientListIcon, StethoscopeIcon } from '../assets';
import { MedicalHistoryTab } from './MedicalHistoryTab';

export const AppointmentTabs: FC = () => {
  const [tabName, setTabName] = useState('hpi');

  const handleTabChange = (_event: React.SyntheticEvent, newTabName: string): void => {
    setTabName(newTabName);
  };

  return (
    <TabContext value={tabName}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <TabList onChange={handleTabChange} aria-label="Tabs">
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <AssignmentIndOutlinedIcon />
                <Typography sx={{ textTransform: 'none', fontWeight: 700, fontSize: '14px' }}>
                  HPI and Medical history
                </Typography>
              </Box>
            }
            value="hpi"
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <StethoscopeIcon />
                <Typography sx={{ textTransform: 'none', fontWeight: 700, fontSize: '14px' }}>Examination</Typography>
              </Box>
            }
            value="examination"
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <DiagnosisIcon />
                <Typography sx={{ textTransform: 'none', fontWeight: 700, fontSize: '14px' }}>
                  MDM & Diagnosis
                </Typography>
              </Box>
            }
            value="mdm"
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <PatientListIcon />
                <Typography sx={{ textTransform: 'none', fontWeight: 700, fontSize: '14px' }}>Instructions</Typography>
              </Box>
            }
            value="instructions"
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <ContractEditIcon />
                <Typography sx={{ textTransform: 'none', fontWeight: 700, fontSize: '14px' }}>Sign</Typography>
              </Box>
            }
            value="sign"
          />
        </TabList>
      </Box>
      <TabPanel value="hpi" sx={{ p: 0, mb: 5 }}>
        <MedicalHistoryTab />
      </TabPanel>
    </TabContext>
  );
};
