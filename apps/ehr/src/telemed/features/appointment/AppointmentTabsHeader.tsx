import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import { TabContext, TabList } from '@mui/lab';
import { Box, Tab, Typography } from '@mui/material';
import React, { FC } from 'react';
import { getSelectors } from '../../../shared/store/getSelectors';
import { ContractEditIcon, DiagnosisIcon, PatientListIcon, StethoscopeIcon } from '../../assets';
import { useAppointmentStore } from '../../state';
import { dataTestIds } from '../../../constants/data-test-ids';
import { TelemedAppointmentVisitTabs } from 'utils';

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
          data-testid={dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.hpi)}
          value={TelemedAppointmentVisitTabs.hpi}
        />
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <StethoscopeIcon />
              <Typography sx={{ textTransform: 'none', fontWeight: 700, fontSize: '14px' }}>Exam</Typography>
            </Box>
          }
          data-testid={dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.exam)}
          value={TelemedAppointmentVisitTabs.exam}
        />
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <DiagnosisIcon />
              <Typography sx={{ textTransform: 'none', fontWeight: 700, fontSize: '14px' }}>Assessment</Typography>
            </Box>
          }
          data-testid={dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.assessment)}
          value={TelemedAppointmentVisitTabs.assessment}
        />
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <PatientListIcon />
              <Typography sx={{ textTransform: 'none', fontWeight: 700, fontSize: '14px' }}>Plan</Typography>
            </Box>
          }
          data-testid={dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.plan)}
          value={TelemedAppointmentVisitTabs.plan}
        />
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <ContractEditIcon />
              <Typography sx={{ textTransform: 'none', fontWeight: 700, fontSize: '14px' }}>Review and Sign</Typography>
            </Box>
          }
          data-testid={dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)}
          value={TelemedAppointmentVisitTabs.sign}
        />
      </TabList>
    </TabContext>
  );
};
