import { Box, Button, ButtonGroup } from '@mui/material';
import { ReactElement, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ScheduleInformation, ScheduleType } from '../components/ScheduleInformation';

export default function SchedulesPage(): ReactElement {
  const location = useLocation();
  const [tab, setTab] = useState<ScheduleType>(location.state?.defaultTab || 'location');

  return (
    <Box sx={{ marginTop: 2 }}>
      <ButtonGroup size="medium" aria-label="Switch between different schedule options" sx={{ marginBottom: 2 }}>
        <Button variant={tab === 'location' ? 'contained' : 'outlined'} onClick={() => setTab('location')}>
          Locations
        </Button>
        <Button variant={tab === 'provider' ? 'contained' : 'outlined'} onClick={() => setTab('provider')}>
          Providers
        </Button>
        <Button variant={tab === 'group' ? 'contained' : 'outlined'} onClick={() => setTab('group')}>
          Groups
        </Button>
      </ButtonGroup>
      {/* <ScheduleInformation scheduleType={tab}></ScheduleInformation> */}
      {tab === 'location' && <ScheduleInformation scheduleType="location" />}
      {tab === 'provider' && <ScheduleInformation scheduleType="provider" />}
      {tab === 'group' && <ScheduleInformation scheduleType="group" />}
    </Box>
  );
}
