import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Tab } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { ButtonRounded } from 'src/features/visits/in-person/components/RoundedButton';
import InHouseLabAdminPage from 'src/features/visits/telemed/components/admin/in-house-labs/InHouseLabAdminPage';
import BillingConfiguration from '../features/visits/telemed/components/admin/BillingConfiguration';
import GlobalTemplatesAdminPage from '../features/visits/telemed/components/admin/GlobalTemplatesAdminPage';
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
  'global-templates' = 'global-templates',
  medications = 'medications',
  billing = 'billing',
  'quick-picks' = 'quick-picks',
  'in-house-labs' = 'in-house-labs',
}

export function AdminPage(): JSX.Element {
  const { adminTab, billingTab } = useParams();
  const navigate = useNavigate();

  const pageTab = billingTab ? PageTab.billing : (adminTab as PageTab) || PageTab.schedules;

  return (
    <PageContainer>
      <Box sx={{ width: '100%', marginTop: 3 }}>
        <TabContext value={pageTab}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Box sx={{ flex: 1, borderBottom: 1, borderColor: 'divider' }}>
              <TabList onChange={() => {}} aria-label={`${pageTab} page`}>
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
                  label="Global Templates"
                  value={PageTab['global-templates']}
                  sx={{ textTransform: 'none', fontWeight: 500 }}
                  onClick={() => navigate(`/admin/${PageTab['global-templates']}`)}
                />
                <Tab
                  label="Medications"
                  value={PageTab.medications}
                  sx={{ textTransform: 'none', fontWeight: 500 }}
                  onClick={() => navigate(`/admin/${PageTab.medications}`)}
                />
                <Tab
                  label="Billing Configuration"
                  value={PageTab.billing}
                  sx={{ textTransform: 'none', fontWeight: 500 }}
                  onClick={() => navigate(`/admin/${PageTab.billing}`)}
                />
                <Tab
                  label="Quick Picks"
                  value={PageTab['quick-picks']}
                  sx={{ textTransform: 'none', fontWeight: 500 }}
                  onClick={() => navigate(`/admin/${PageTab['quick-picks']}`)}
                />
                <Tab
                  label="In-House Labs"
                  value={PageTab['in-house-labs']}
                  sx={{ textTransform: 'none', fontWeight: 500 }}
                  onClick={() => navigate(`/admin/${PageTab['in-house-labs']}`)}
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
          <TabPanel value={PageTab['global-templates']} sx={{ padding: 0 }}>
            <GlobalTemplatesAdminPage />
          </TabPanel>
          <TabPanel value={PageTab.medications} sx={{ padding: 0 }}>
            <MedicationsConfigurationPage />
          </TabPanel>
          <TabPanel value={PageTab.billing} sx={{ padding: 0 }}>
            <BillingConfiguration billingTab={billingTab} />
          </TabPanel>
          <TabPanel value={PageTab['quick-picks']} sx={{ padding: 0 }}>
            <QuickPicksAdminPage />
          </TabPanel>
          <TabPanel value={PageTab['in-house-labs']} sx={{ padding: 0 }}>
            <InHouseLabAdminPage />
          </TabPanel>
        </TabContext>
      </Box>
    </PageContainer>
  );
}
