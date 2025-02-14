import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import { TabContext, TabList } from '@mui/lab';
import { Box, Tab, Typography } from '@mui/material';
import React, { FC } from 'react';
import { getSelectors } from '../../../shared/store/getSelectors';
import { ContractEditIcon, DiagnosisIcon, PatientListIcon, StethoscopeIcon } from '../../assets';
import { useAppointmentStore } from '../../state';
import { dataTestIds } from '../../../constants/data-test-ids';

export const AppointmentTabsHeader: FC = () => {
  const { currentTab } = getSelectors(useAppointmentStore, ['currentTab']);

  const handleTabChange = (_event: React.SyntheticEvent, newTabName: string): void => {
    useAppointmentStore.setState({ currentTab: newTabName });
  };

  return (
    <TabContext value={currentTab}>
      <TabList onChange={handleTabChange}>
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
              <Typography sx={{ textTransform: 'none', fontWeight: 700, fontSize: '14px' }}>Exam</Typography>
            </Box>
          }
          value="exam"
        />
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <DiagnosisIcon />
              <Typography sx={{ textTransform: 'none', fontWeight: 700, fontSize: '14px' }}>Assessment</Typography>
            </Box>
          }
          value="erx"
        />
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <PatientListIcon />
              <Typography sx={{ textTransform: 'none', fontWeight: 700, fontSize: '14px' }}>Plan</Typography>
            </Box>
          }
          value="plan"
        />
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <ContractEditIcon />
              <Typography sx={{ textTransform: 'none', fontWeight: 700, fontSize: '14px' }}>Review and Sign</Typography>
            </Box>
          }
          value="sign"
        />
      </TabList>
    </TabContext>
  );
};
