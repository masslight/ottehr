import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Tab } from '@mui/material';
import React, { useState } from 'react';
import { VisitFeedbackSettings } from './VisitFeedbackSettings';

type SettingsSubTab = 'visit-feedback';

const SettingsPage: React.FC = () => {
  const [subTab, setSubTab] = useState<SettingsSubTab>('visit-feedback');

  return (
    <Box sx={{ mt: 2 }}>
      <TabContext value={subTab}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <TabList onChange={(_, value) => setSubTab(value)} aria-label="Settings tabs">
            <Tab label="Visit Feedback" value="visit-feedback" sx={{ textTransform: 'none', fontWeight: 500 }} />
          </TabList>
        </Box>
        <TabPanel value="visit-feedback" sx={{ px: 0 }}>
          <VisitFeedbackSettings />
        </TabPanel>
      </TabContext>
    </Box>
  );
};

export default SettingsPage;
