import { otherColors } from '@ehrTheme/colors';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Badge, Box, Tab } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ButtonRounded } from 'src/features/visits/in-person/components/RoundedButton';
import InHouseLabAdminPage from 'src/features/visits/telemed/components/admin/in-house-labs/InHouseLabAdminPage';
import { getEmployees } from '../api/api';
import { dataTestIds } from '../constants/data-test-ids';
import BillingConfiguration from '../features/visits/telemed/components/admin/BillingConfiguration';
import GlobalTemplatesAdminPage from '../features/visits/telemed/components/admin/GlobalTemplatesAdminPage';
import QuickPicksAdminPage from '../features/visits/telemed/components/admin/QuickPicksAdminPage';
import States from '../features/visits/telemed/components/admin/VirtualLocationsPage';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';
import MedicationsConfigurationPage from './configuration/MedicationsConfiguration';
import EmployeesPage, { EmployeeTypes } from './Employees';
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
}

export function AdminPage(): JSX.Element {
  const { adminTab, billingTab } = useParams();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const pageTab = billingTab ? PageTab.billing : (adminTab as PageTab) || PageTab.schedules;

  const employeesQuery = useQuery({
    queryKey: ['get-employees'],
    queryFn: () => (oystehrZambda ? getEmployees(oystehrZambda) : Promise.resolve(null)),
    enabled: !!oystehrZambda,
  });

  const pendingReviewCount = employeesQuery.data?.employees.filter((e) => e.needsReview).length ?? 0;

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
                  label={
                    <Badge
                      badgeContent={pendingReviewCount}
                      data-testid={dataTestIds.employeesPage.needsReviewBadge}
                      sx={{
                        '& .MuiBadge-badge': {
                          right: -10,
                          top: 2,
                          bgcolor: otherColors.priorityHighIcon,
                          color: '#fff',
                        },
                      }}
                    >
                      Employees
                    </Badge>
                  }
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
            <BillingConfiguration billingTab={billingTab} />
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
        </TabContext>
      </Box>
    </PageContainer>
  );
}
