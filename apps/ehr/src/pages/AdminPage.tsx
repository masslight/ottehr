import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Tab } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ButtonRounded } from 'src/features/visits/in-person/components/RoundedButton';
import Insurances from '../features/visits/telemed/components/admin/Insurance';
import QuickPicksAdminPage from '../features/visits/telemed/components/admin/QuickPicksAdminPage';
import States from '../features/visits/telemed/components/admin/VirtualLocationsPage';
import PageContainer from '../layout/PageContainer';
import MedicationsConfigurationPage from './configuration/MedicationsConfiguration';
import EmployeesPage, { EmployeeTypes } from './Employees';
import SchedulesPage from './Schedules';

enum PageTab {
  schedules = 'schedules',
  'virtual-locations' = 'virtual-locations',
  employees = 'employees',
  providers = 'providers',
  insurance = 'insurances',
  medications = 'medications',
  'quick-picks' = 'quick-picks',
}

export function AdminPage(): JSX.Element {
  const { adminTab } = useParams();
  const [pageTab, setPageTab] = useState<PageTab>(PageTab.schedules);
  const navigate = useNavigate();

  const page = adminTab as PageTab;

  useEffect(() => {
    if (page) {
      setPageTab(page);
    }
  }, [page]);

  const handleTabChange = (_: any, newValue: PageTab): any => {
    setPageTab(newValue);
  };

  return (
    <PageContainer>
      <Box sx={{ width: '100%', marginTop: 3 }}>
        <TabContext value={pageTab}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Box sx={{ flex: 1, borderBottom: 1, borderColor: 'divider' }}>
              <TabList onChange={handleTabChange} aria-label={`${page} page`}>
                <Tab
                  label="Schedules"
                  value={PageTab.schedules}
                  sx={{ textTransform: 'none', fontWeight: 500 }}
                  onClick={() => navigate(`/admin/${PageTab.schedules}`)}
                />
                <Tab
                  label="Virtual Locations"
                  value={PageTab['virtual-locations']}
                  sx={{ textTransform: 'none', fontWeight: 500 }}
                  onClick={() => navigate(`/admin/${PageTab['virtual-locations']}`)}
                />
                <Tab
                  label="Employees"
                  value={PageTab.employees}
                  sx={{ textTransform: 'none', fontWeight: 500 }}
                  onClick={() => navigate(`/admin/${PageTab.employees}`)}
                />
                <Tab
                  label="Providers"
                  value={PageTab.providers}
                  sx={{ textTransform: 'none', fontWeight: 500 }}
                  onClick={() => navigate(`/admin/${PageTab.providers}`)}
                />
                <Tab
                  label="Insurance"
                  value={PageTab.insurance}
                  sx={{ textTransform: 'none', fontWeight: 500 }}
                  onClick={() => navigate(`/admin/${PageTab.insurance}`)}
                />
                <Tab
                  label="Medications"
                  value={PageTab.medications}
                  sx={{ textTransform: 'none', fontWeight: 500 }}
                  onClick={() => navigate(`/admin/${PageTab.medications}`)}
                />
                <Tab
                  label="Quick Picks"
                  value={PageTab['quick-picks']}
                  sx={{ textTransform: 'none', fontWeight: 500 }}
                  onClick={() => navigate(`/admin/${PageTab['quick-picks']}`)}
                />
              </TabList>
            </Box>
            <ButtonRounded
              onClick={() => navigate(`/reports`)}
              variant="outlined"
              sx={{
                whiteSpace: 'nowrap',
              }}
            >
              Reports
            </ButtonRounded>
          </Box>
          <TabPanel value={PageTab.schedules} sx={{ padding: 0 }}>
            <SchedulesPage />
          </TabPanel>
          <TabPanel value={PageTab['virtual-locations']} sx={{ padding: 0 }}>
            <States />
          </TabPanel>
          <TabPanel value={PageTab.employees} sx={{ padding: 0 }}>
            <EmployeesPage employeeType={EmployeeTypes.employees} />
          </TabPanel>
          <TabPanel value={PageTab.providers} sx={{ padding: 0 }}>
            <EmployeesPage employeeType={EmployeeTypes.providers} />
          </TabPanel>
          <TabPanel value={PageTab.insurance} sx={{ padding: 0 }}>
            <Insurances />
          </TabPanel>
          <TabPanel value={PageTab.medications} sx={{ padding: 0 }}>
            <MedicationsConfigurationPage />
          </TabPanel>
          <TabPanel value={PageTab['quick-picks']} sx={{ padding: 0 }}>
            <QuickPicksAdminPage />
          </TabPanel>
        </TabContext>
      </Box>
    </PageContainer>
  );
}
