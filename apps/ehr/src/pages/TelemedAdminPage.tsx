import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Paper, Tab } from '@mui/material';
import { useEffect, useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import { VIRTUAL_LOCATIONS_URL } from 'src/App';
import PageContainer from '../layout/PageContainer';
import Insurances from '../telemed/features/telemed-admin/Insurance';
import States from '../telemed/features/telemed-admin/VirtualLocationsPage';

enum PageTab {
  insurance = 'insurances',
  'virtual-locations' = 'virtual-locations',
}

export function TelemedAdminPage(): JSX.Element {
  const [pageTab, setPageTab] = useState<PageTab>(PageTab.insurance);
  const navigate = useNavigate();

  const statesMatch = useMatch(VIRTUAL_LOCATIONS_URL);
  const page = statesMatch ? PageTab['virtual-locations'] : PageTab.insurance;

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
                sx={{ textTransform: 'none', fontWeight: 500 }}
                onClick={() => navigate(`/telemed-admin/${PageTab.insurance}`)}
              />
              <Tab
                label="Virtual Locations"
                value={PageTab['virtual-locations']}
                sx={{ textTransform: 'none', fontWeight: 500 }}
                onClick={() => navigate(`/telemed-admin/${PageTab['virtual-locations']}`)}
              />
            </TabList>
          </Box>
          <Paper sx={{ marginTop: 5 }}>
            <TabPanel value={pageTab} sx={{ padding: 0 }}>
              {pageTab === PageTab.insurance && <Insurances />}
              {pageTab === PageTab['virtual-locations'] && <States />}
            </TabPanel>
          </Paper>
        </TabContext>
      </Box>
    </PageContainer>
  );
}
