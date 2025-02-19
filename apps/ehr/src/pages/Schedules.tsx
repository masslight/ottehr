import { Box, Tab } from '@mui/material';
import { ReactElement, useState } from 'react';
import PageContainer from '../layout/PageContainer';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import { ScheduleInformation } from '../components/ScheduleInformation';

export default function SchedulesPage(): ReactElement {
  const [tab, setTab] = useState<string>('0');

  return (
    <PageContainer>
      <>
        <TabContext value={tab}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mx: 3 }}>
            <TabList
              onChange={(event, tabTemp) => setTab(tabTemp)}
              aria-label="Switch between different schedule options"
            >
              <Tab label="Locations" value="0" sx={{ textTransform: 'none', fontWeight: 700 }} />
              <Tab label="Providers" value="1" sx={{ textTransform: 'none', fontWeight: 700 }} />
              <Tab label="Groups" value="2" sx={{ textTransform: 'none', fontWeight: 700 }} />
            </TabList>
          </Box>
          <TabPanel value="0">
            <ScheduleInformation scheduleType="location"></ScheduleInformation>
          </TabPanel>
          <TabPanel value="1">
            <ScheduleInformation scheduleType="provider"></ScheduleInformation>
          </TabPanel>
          <TabPanel value="2">
            <ScheduleInformation scheduleType="group"></ScheduleInformation>
          </TabPanel>
        </TabContext>
      </>
    </PageContainer>
  );
}
