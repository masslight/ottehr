import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Tab } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { ButtonRounded } from 'src/features/visits/in-person/components/RoundedButton';
import InHouseLabAdminPage from 'src/features/visits/telemed/components/admin/in-house-labs/InHouseLabAdminPage';
import LabSetsAdminPage from 'src/features/visits/telemed/components/admin/lab-sets/LabSetsAdminPage';
import AdminPrintingConfig from 'src/features/visits/telemed/components/admin/label-printing-config/AdminLabelPrintingConfigPage';
import BillingConfiguration from '../features/visits/telemed/components/admin/BillingConfiguration';
import GlobalTemplatesAdminPage from '../features/visits/telemed/components/admin/GlobalTemplatesAdminPage';
import QuickPicksAdminPage from '../features/visits/telemed/components/admin/QuickPicksAdminPage';
import States from '../features/visits/telemed/components/admin/VirtualLocationsPage';
import PageContainer from '../layout/PageContainer';
import AdminCustomFoldersPage from './AdminCustomFoldersPage';
import MedicationsConfigurationPage from './configuration/MedicationsConfiguration';
import EmployeesPage, { EmployeeTypes } from './Employees';
import OutreachTab from './OutreachTab';
import SchedulesPage from './Schedules';

enum PageTab {
  schedules = 'schedules',
  'virtual-locations' = 'virtual-locations',
  employees = 'employees',
  providers = 'providers',
  'global-templates' = 'global-templates',
  medications = 'medications',
  billing = 'billing',
  'quick-picks' = 'quick-picks',
  'in-house-labs' = 'in-house-labs',
  outreach = 'outreach',
  'label-printing-config' = 'label-printing-config',
  'em-codes' = 'em-codes',
  'lab-sets' = 'lab-sets',
  'docs-folders' = 'docs-folders',
}

export function AdminPage(): JSX.Element {
  const { adminTab, billingTab, outreachSubTab, outreachDetailTab, insuranceTab } = useParams();
  const navigate = useNavigate();

  const pageTab = billingTab
    ? PageTab.billing
    : outreachSubTab
    ? PageTab.outreach
    : (adminTab as PageTab) || PageTab.schedules;

  return (
    <PageContainer>
      <Box sx={{ width: '100%', marginTop: 3 }}>
        <TabContext value={pageTab}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Box sx={{ flex: 1, minWidth: 0, borderBottom: 1, borderColor: 'divider' }}>
              <TabList
                onChange={() => {}}
                aria-label={`${pageTab} page`}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
              >
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
                  label="In-House Medications"
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
                  label="Global Templates"
                  value={PageTab['global-templates']}
                  sx={{ textTransform: 'none', fontWeight: 500 }}
                  onClick={() => navigate(`/admin/${PageTab['global-templates']}`)}
                />
                <Tab
                  label="In-House Labs"
                  value={PageTab['in-house-labs']}
                  sx={{ textTransform: 'none', fontWeight: 500 }}
                  onClick={() => navigate(`/admin/${PageTab['in-house-labs']}`)}
                />
                <Tab
                  label="Outreach"
                  value={PageTab.outreach}
                  sx={{ textTransform: 'none', fontWeight: 500 }}
                  onClick={() => navigate(`/admin/${PageTab.outreach}`)}
                />
                <Tab
                  label="Lab Sets"
                  value={PageTab['lab-sets']}
                  sx={{ textTransform: 'none', fontWeight: 500 }}
                  onClick={() => navigate(`/admin/${PageTab['lab-sets']}`)}
                />
                <Tab
                  label="Label Printing Config"
                  value={PageTab['label-printing-config']}
                  sx={{ textTransform: 'none', fontWeight: 500 }}
                  onClick={() => navigate(`/admin/${PageTab['label-printing-config']}`)}
                />
                <Tab
                  label="Docs Folders"
                  value={PageTab['docs-folders']}
                  sx={{ textTransform: 'none', fontWeight: 500 }}
                  onClick={() => navigate(`/admin/${PageTab['docs-folders']}`)}
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
          <TabPanel value={PageTab.medications} sx={{ padding: 0 }}>
            <MedicationsConfigurationPage />
          </TabPanel>
          <TabPanel value={PageTab.billing} sx={{ padding: 0 }}>
            <BillingConfiguration billingTab={billingTab} insuranceTab={insuranceTab} />
          </TabPanel>
          <TabPanel value={PageTab['quick-picks']} sx={{ padding: 0 }}>
            <QuickPicksAdminPage />
          </TabPanel>
          <TabPanel value={PageTab['global-templates']} sx={{ padding: 0 }}>
            <GlobalTemplatesAdminPage />
          </TabPanel>
          <TabPanel value={PageTab['in-house-labs']} sx={{ padding: 0 }}>
            <InHouseLabAdminPage />
          </TabPanel>
          <TabPanel value={PageTab.outreach} sx={{ padding: 0 }}>
            <OutreachTab outreachSubTab={outreachSubTab} outreachDetailTab={outreachDetailTab} />
          </TabPanel>
          <TabPanel value={PageTab['lab-sets']} sx={{ padding: 0 }}>
            <LabSetsAdminPage />
          </TabPanel>
          <TabPanel value={PageTab['label-printing-config']} sx={{ padding: 0 }}>
            <AdminPrintingConfig />
          </TabPanel>
          <TabPanel value={PageTab['docs-folders']} sx={{ padding: 0 }}>
            <AdminCustomFoldersPage />
          </TabPanel>
        </TabContext>
      </Box>
    </PageContainer>
  );
}
