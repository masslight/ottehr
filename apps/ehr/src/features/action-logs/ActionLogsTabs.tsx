import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Tab } from '@mui/material';
import { FC, useState } from 'react';
import { ActionLogsTable } from './ActionLogsTable';

interface ActionLogsTabsProps {
  patientId?: string;
}

export const ActionLogsTabs: FC<ActionLogsTabsProps> = ({ patientId }) => {
  const [tab, setTab] = useState('fax');
  return (
    <TabContext value={tab}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <TabList onChange={(_, value: string) => setTab(value)} aria-label="Action log type">
          <Tab value="fax" label="Fax Logs" sx={{ textTransform: 'none', fontWeight: 500 }} />
          <Tab value="email" label="Email Logs" sx={{ textTransform: 'none', fontWeight: 500 }} />
        </TabList>
      </Box>
      <TabPanel value="fax" sx={{ p: 0, pt: 2 }}>
        <ActionLogsTable channel="fax" patientId={patientId} />
      </TabPanel>
      <TabPanel value="email" sx={{ p: 0, pt: 2 }}>
        <ActionLogsTable channel="email" patientId={patientId} />
      </TabPanel>
    </TabContext>
  );
};
