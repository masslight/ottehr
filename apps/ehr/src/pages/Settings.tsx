import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Paper, Tab, Typography } from '@mui/material';
import { useState } from 'react';
import { AutomateReport } from 'src/components/AutomateReport';
import { NotificationHierarchy } from 'src/components/NotificationHierarchy';
import PageContainer from '../layout/PageContainer';

export default function Settings(): JSX.Element {
  const [tab, setTab] = useState('reports');

  return (
    <PageContainer tabTitle="Settings">
      <Paper
        sx={{
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <TabContext value={tab}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <TabList onChange={(_, newTab) => setTab(newTab)}>
              <Tab
                value="reports"
                label={
                  <Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>
                    Reports Settings
                  </Typography>
                }
              />
              <Tab
                value="notifications"
                label={
                  <Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>
                    Notifications Settings
                  </Typography>
                }
              />
            </TabList>
          </Box>

          <TabPanel value="reports" sx={{ p: 2 }}>
            <AutomateReport />
          </TabPanel>

          <TabPanel value="notifications" sx={{ p: 2 }}>
            <NotificationHierarchy />
          </TabPanel>
        </TabContext>
      </Paper>
    </PageContainer>
  );
}
