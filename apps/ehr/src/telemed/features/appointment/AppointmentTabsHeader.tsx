import { ottehrAiIcon } from '@ehrTheme/icons';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import { TabContext, TabList } from '@mui/lab';
import { Box, ListItemIcon, Tab, Typography } from '@mui/material';
import React, { FC } from 'react';
import { sidebarMenuIcons } from 'src/features/css-module/components/Sidebar';
import { TelemedAppointmentVisitTabs } from 'utils';
import { dataTestIds } from '../../../constants/data-test-ids';
import { ContractEditIcon, DiagnosisIcon, PatientListIcon, StethoscopeIcon } from '../../assets';
import { useAppTelemedLocalStore, useChartData } from '../../state';

export const AppointmentTabsHeader: FC = () => {
  const currentTab = useAppTelemedLocalStore((state) => state.currentTab);
  const { chartData } = useChartData();

  const handleTabChange = (_event: React.SyntheticEvent, newTabName: string): void => {
    useAppTelemedLocalStore.setState({ currentTab: newTabName });
  };

  return (
    <TabContext value={currentTab}>
      <TabList onChange={handleTabChange}>
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <AssignmentIndOutlinedIcon />
              <Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>
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
              <ListItemIcon sx={{ height: 24, width: 24, minWidth: 24 }}>{sidebarMenuIcons.Vitals}</ListItemIcon>
              <Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>Vitals</Typography>
            </Box>
          }
          data-testid={dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.vitals)}
          value={TelemedAppointmentVisitTabs.vitals}
        />
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <StethoscopeIcon />
              <Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>Exam</Typography>
            </Box>
          }
          data-testid={dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.exam)}
          value={TelemedAppointmentVisitTabs.exam}
        />
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <DiagnosisIcon />
              <Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>Assessment</Typography>
            </Box>
          }
          data-testid={dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.assessment)}
          value={TelemedAppointmentVisitTabs.assessment}
        />
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <PatientListIcon />
              <Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>Plan</Typography>
            </Box>
          }
          data-testid={dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.plan)}
          value={TelemedAppointmentVisitTabs.plan}
        />
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <ContractEditIcon />
              <Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>Review and Sign</Typography>
            </Box>
          }
          data-testid={dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)}
          value={TelemedAppointmentVisitTabs.sign}
        />
        {chartData?.aiChat != null ? (
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <img src={ottehrAiIcon} style={{ width: '24px' }} />
                <Typography sx={{ textTransform: 'none', fontWeight: 700, fontSize: '14px' }}>Oystehr AI</Typography>
              </Box>
            }
            value={TelemedAppointmentVisitTabs.ottehrai}
          />
        ) : undefined}
      </TabList>
    </TabContext>
  );
};
