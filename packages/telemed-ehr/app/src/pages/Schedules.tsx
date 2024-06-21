import { Tab } from '@mui/material';
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
          <TabList
            onChange={(event, tabTemp) => setTab(tabTemp)}
            aria-label="Switch between different schedule options"
            sx={{
              paddingX: 3,
            }}
          >
            <Tab label="Offices" value="0" />
            <Tab label="Providers" value="1" />
            <Tab label="Groups" value="2" />
          </TabList>
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
