import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Tab } from '@mui/material';
import { ReactElement, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ScheduleInformation } from '../components/ScheduleInformation';
import PageContainer from '../layout/PageContainer';

export default function SchedulesPage(): ReactElement {
  const location = useLocation();
  const [tab, setTab] = useState<string>(location.state?.defaultTab || 'location');

  return (
    <PageContainer>
      <>
        <TabContext value={tab}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mx: 3 }}>
            <TabList
              onChange={(event, tabTemp) => setTab(tabTemp)}
              aria-label="Switch between different schedule options"
            >
              <Tab label="Locations" value="location" sx={{ textTransform: 'none', fontWeight: 500 }} />
              <Tab label="Providers" value="provider" sx={{ textTransform: 'none', fontWeight: 500 }} />
              <Tab label="Groups" value="group" sx={{ textTransform: 'none', fontWeight: 500 }} />
            </TabList>
          </Box>
          <TabPanel value="location">
            <ScheduleInformation scheduleType="location"></ScheduleInformation>
          </TabPanel>
          <TabPanel value="provider">
            <ScheduleInformation scheduleType="provider"></ScheduleInformation>
          </TabPanel>
          <TabPanel value="group">
            <ScheduleInformation scheduleType="group"></ScheduleInformation>
          </TabPanel>
        </TabContext>
      </>
    </PageContainer>
  );
}
