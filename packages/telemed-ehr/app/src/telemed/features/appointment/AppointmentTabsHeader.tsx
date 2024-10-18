import React, { FC } from 'react';
import { TabContext, TabList } from '@mui/lab';
import { Box, Tab, Typography } from '@mui/material';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../state';
import {
  ContractEditIcon,
  DiagnosisIcon,
  StethoscopeIcon,
} from '../../assets';

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
              <Typography sx={{ textTransform: 'none', fontWeight: 700, fontSize: '14px' }}>
                eRX and Assessment
              </Typography>
            </Box>
          }
          value="erx"
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
