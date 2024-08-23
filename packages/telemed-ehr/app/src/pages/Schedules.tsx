import { Box, Tab } from '@mui/material';
import { ReactElement, useState } from 'react';
import PageContainer from '../layout/PageContainer';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import { ScheduleInformation } from '../components/ScheduleInformation';

function a11yProps(index: number): { id: string; 'aria-controls': string } {
  return {
    id: `tab-${index}`,
    'aria-controls': `tabpanel-${index}`,
  };
}

export default function LocationsPage(): ReactElement {
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
              <Tab label="Offices" value="0" sx={{ textTransform: 'none', fontWeight: 700 }} />
              <Tab label="Providers" value="1" sx={{ textTransform: 'none', fontWeight: 700 }} />
              <Tab label="Groups" value="2" sx={{ textTransform: 'none', fontWeight: 700 }} />
            </TabList>
          </Box>
          <TabPanel value="0">
            <ScheduleInformation scheduleType="office"></ScheduleInformation>
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
