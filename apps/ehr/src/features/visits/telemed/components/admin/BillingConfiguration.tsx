import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Paper, Tab, Typography } from '@mui/material';
import React, { ReactElement } from 'react';
import FeeSchedule from './FeeSchedule';

type BillingSubTab = 'fee-schedules' | 'charge-masters' | 'payments';

export default function BillingConfiguration(): ReactElement {
  const [subTab, setSubTab] = React.useState<BillingSubTab>('fee-schedules');

  const handleSubTabChange = (_: unknown, newValue: BillingSubTab): void => {
    setSubTab(newValue);
  };

  return (
    <Box sx={{ marginTop: 2 }}>
      <TabContext value={subTab}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <TabList onChange={handleSubTabChange} aria-label="Billing configuration tabs">
            <Tab label="Fee Schedules" value="fee-schedules" sx={{ textTransform: 'none', fontWeight: 500 }} />
            <Tab label="Charge Masters" value="charge-masters" sx={{ textTransform: 'none', fontWeight: 500 }} />
            <Tab label="Payments" value="payments" sx={{ textTransform: 'none', fontWeight: 500 }} />
          </TabList>
        </Box>
        <TabPanel value="fee-schedules" sx={{ padding: 0 }}>
          <FeeSchedule />
        </TabPanel>
        <TabPanel value="charge-masters" sx={{ padding: 0 }}>
          <FeeSchedule mode="charge-master" />
        </TabPanel>
        <TabPanel value="payments" sx={{ padding: 0 }}>
          <Paper sx={{ padding: 4, marginTop: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              Payments configuration coming soon
            </Typography>
          </Paper>
        </TabPanel>
      </TabContext>
    </Box>
  );
}
