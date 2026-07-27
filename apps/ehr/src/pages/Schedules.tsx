import { Box, Button, ButtonGroup } from '@mui/material';
import { ReactElement, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SchedulesTable } from '../components/schedule/SchedulesTable';
import { ScheduleInformation } from '../components/ScheduleInformation';

type SchedulesTab = 'schedules' | 'groups';

export default function SchedulesPage(): ReactElement {
  const location = useLocation();
  // Locations + Providers are merged into one "Schedules" view; Groups stays its
  // own tab for now (slated to become its own nav item in the Groups rework).
  const initial = location.state?.defaultTab;
  const [tab, setTab] = useState<SchedulesTab>(initial === 'group' ? 'groups' : 'schedules');

  return (
    <Box sx={{ marginTop: 2 }}>
      <ButtonGroup size="medium" aria-label="Switch between schedules and groups" sx={{ marginBottom: 2 }}>
        <Button variant={tab === 'schedules' ? 'contained' : 'outlined'} onClick={() => setTab('schedules')}>
          Schedules
        </Button>
        <Button variant={tab === 'groups' ? 'contained' : 'outlined'} onClick={() => setTab('groups')}>
          Groups
        </Button>
      </ButtonGroup>
      {tab === 'schedules' && <SchedulesTable />}
      {tab === 'groups' && <ScheduleInformation scheduleType="group" />}
    </Box>
  );
}
