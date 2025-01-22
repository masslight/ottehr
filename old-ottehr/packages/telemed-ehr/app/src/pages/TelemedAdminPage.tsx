import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Paper, Tab } from '@mui/material';
import { useEffect, useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import PageContainer from '../layout/PageContainer';
import States from '../telemed/features/telemed-admin/States';
import Insurances from '../telemed/features/telemed-admin/Insurance';

enum PageTab {
  insurance = 'insurances',
  states = 'states',
}

export function TelemedAdminPage(): JSX.Element {
  const [pageTab, setPageTab] = useState<PageTab>(PageTab.insurance);
  const navigate = useNavigate();

  const statesMatch = useMatch('/telemed-admin/states');
  const page = statesMatch ? PageTab.states : PageTab.insurance;

  useEffect(() => {
    setPageTab(page);
  }, [page]);

  const handleTabChange = (_: any, newValue: PageTab): any => {
    setPageTab(newValue);
  };

  return (
    <PageContainer>
      <Box sx={{ width: '100%', marginTop: 3 }}>
        <TabContext value={pageTab}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <TabList onChange={handleTabChange} aria-label={`${page} page`}>
              <Tab
                label="Insurance"
                value={PageTab.insurance}
                sx={{ textTransform: 'none', fontWeight: 700 }}
                onClick={() => navigate(`/telemed-admin/${PageTab.insurance}`)}
              />
              <Tab
                label="States"
                value={PageTab.states}
                sx={{ textTransform: 'none', fontWeight: 700 }}
                onClick={() => navigate(`/telemed-admin/${PageTab.states}`)}
              />
            </TabList>
          </Box>
          <Paper sx={{ marginTop: 5 }}>
            <TabPanel value={pageTab} sx={{ padding: 0 }}>
              {pageTab === PageTab.insurance && <Insurances />}
              {pageTab === PageTab.states && <States />}
            </TabPanel>
          </Paper>
        </TabContext>
      </Box>
    </PageContainer>
  );
}
