import { TabContext } from '@mui/lab';
import { CssBaseline } from '@mui/material';
import { LicenseInfo } from '@mui/x-data-grid-pro';
import { SnackbarProvider } from 'notistack';
import { lazy, ReactElement, Suspense, useState } from 'react';
import { useIdleTimer } from 'react-idle-timer';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { parseCommaSeparatedTags, RoleType } from 'utils';
import { setupSentry } from 'utils/lib/frontend';
import Banner from './components/Banner';
import { CommandPalette } from './components/CommandPalette';
import { CommandPaletteRegistrations } from './components/CommandPaletteRegistrations';
import LogoutWarning from './components/dialogs/LogoutWarning';
import { LoadingScreen } from './components/LoadingScreen';
import Navbar from './components/navigation/Navbar';
import { ProtectedRoute } from './components/routing/ProtectedRoute';
import { TestErrorPage } from './components/TestErrorPage';
import { FEATURE_FLAGS } from './constants/feature-flags';
import { CustomThemeProvider } from './CustomThemeProvider';
import { useApiClients } from './hooks/useAppClients';
import useEvolveUser from './hooks/useEvolveUser';
import AppointmentsPage from './pages/Appointments';
import Logout from './pages/Logout';
import { useNavStore } from './state/nav.store';

// Lazy-loaded pages — excluded from the initial bundle
const UnsolicitedResultsInbox = lazy(() =>
  import('./features/external-labs/pages/UnsolicitedResultsInbox').then((m) => ({ default: m.UnsolicitedResultsInbox }))
);
const UnsolicitedResultsMatch = lazy(() =>
  import('./features/external-labs/pages/UnsolicitedResultsMatch').then((m) => ({ default: m.UnsolicitedResultsMatch }))
);
const UnsolicitedResultsReview = lazy(() =>
  import('./features/external-labs/pages/UnsolicitedResultsReview').then((m) => ({
    default: m.UnsolicitedResultsReview,
  }))
);
const Tasks = lazy(() => import('./features/tasks/pages/Tasks').then((m) => ({ default: m.Tasks })));
const AddPatientFollowup = lazy(() => import('./features/visits/shared/components/patient/AddPatientFollowup'));
const PatientFollowup = lazy(() => import('./features/visits/shared/components/patient/PatientFollowup'));
const EditChargeItem = lazy(() => import('./features/visits/telemed/components/admin/EditChargeItem'));
const EditInsurance = lazy(() => import('./features/visits/telemed/components/admin/EditInsurance'));
const EditVirtualLocationPage = lazy(
  () => import('./features/visits/telemed/components/admin/EditVirtualLocationPage')
);
const GlobalTemplateDetailPage = lazy(
  () => import('./features/visits/telemed/components/admin/GlobalTemplateDetailPage')
);
const ImmunizationQuickPickDetailPage = lazy(
  () => import('./features/visits/telemed/components/admin/ImmunizationQuickPickDetailPage')
);
const AdminAddInHouseLab = lazy(
  () => import('./features/visits/telemed/components/admin/in-house-labs/AdminAddInHouseLab')
);
const AdminInHouseLabDetails = lazy(
  () => import('./features/visits/telemed/components/admin/in-house-labs/AdminInHouseLabDetails')
);
const InHouseMedicationQuickPickDetailPage = lazy(
  () => import('./features/visits/telemed/components/admin/InHouseMedicationQuickPickDetailPage')
);
const AdminAddLabSet = lazy(() => import('./features/visits/telemed/components/admin/lab-sets/AdminAddLabSet'));
const AdminLabSetDetails = lazy(() => import('./features/visits/telemed/components/admin/lab-sets/AdminLabSetDetails'));
const ProcedureQuickPickDetailPage = lazy(
  () => import('./features/visits/telemed/components/admin/ProcedureQuickPickDetailPage')
);
const RadiologyQuickPickDetailPage = lazy(
  () => import('./features/visits/telemed/components/admin/RadiologyQuickPickDetailPage')
);
const AddEmployeePage = lazy(() => import('./pages/AddEmployeePage'));
const AddPatient = lazy(() => import('./pages/AddPatient'));
const AddSchedulePage = lazy(() => import('./pages/AddSchedulePage'));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const AddMedicationPage = lazy(() => import('./pages/configuration/AddMedicationPage'));
const UpdateMedicationPage = lazy(() => import('./pages/configuration/UpdateMedicationPage'));
const EditEmployeePage = lazy(() => import('./pages/EditEmployee'));
const EmployeeProfilePage = lazy(() => import('./pages/EmployeeProfilePage'));
const GroupPage = lazy(() => import('./pages/GroupPage'));
const LegacyDataPage = lazy(() => import('./pages/LegacyDataPage'));
const PatientDocumentsExplorerPage = lazy(() => import('./pages/PatientDocumentsExplorerPage'));
const PatientInformationPage = lazy(() => import('./pages/PatientInformationPage'));
const PatientPage = lazy(() => import('./pages/PatientPage'));
const PatientsPage = lazy(() => import('./pages/Patients'));
const PaymentLocationDetailPage = lazy(() => import('./pages/PaymentLocationDetailPage'));
const Reports = lazy(() => import('./pages/Reports'));
const AiAssistedEncounters = lazy(() =>
  import('./pages/reports/index').then((m) => ({ default: m.AiAssistedEncounters }))
);
const CompleteEncounters = lazy(() => import('./pages/reports/index').then((m) => ({ default: m.CompleteEncounters })));
const DailyPayments = lazy(() => import('./pages/reports/index').then((m) => ({ default: m.DailyPayments })));
const DataExports = lazy(() => import('./pages/reports/index').then((m) => ({ default: m.DataExports })));
const IncompleteEncounters = lazy(() =>
  import('./pages/reports/index').then((m) => ({ default: m.IncompleteEncounters }))
);
const InvoiceablePatientsReportPage = lazy(() =>
  import('./pages/reports/index').then((m) => ({ default: m.InvoiceablePatientsReportPage }))
);
const MailedStatements = lazy(() => import('./pages/reports/index').then((m) => ({ default: m.MailedStatements })));
const PracticeKpis = lazy(() => import('./pages/reports/index').then((m) => ({ default: m.PracticeKpis })));
const RecentPatients = lazy(() => import('./pages/reports/index').then((m) => ({ default: m.RecentPatients })));
const VisitsOverview = lazy(() => import('./pages/reports/index').then((m) => ({ default: m.VisitsOverview })));
const SchedulePage = lazy(() => import('./pages/SchedulePage'));
const TaskAdmin = lazy(() => import('./pages/TaskAdmin'));
const VisitDetailsPage = lazy(() => import('./pages/VisitDetailsPage'));

const { VITE_APP_SENTRY_DSN, VITE_APP_SENTRY_ENV, VITE_APP_SENTRY_TAGS } = import.meta.env;

setupSentry({
  dsn: VITE_APP_SENTRY_DSN,
  environment: VITE_APP_SENTRY_ENV,
  tags: parseCommaSeparatedTags(VITE_APP_SENTRY_TAGS),
});

const InPersonRoutingLazy = lazy(() => import('./features/visits/in-person/routing/InPersonRouting'));

export const INSURANCES_URL = '/admin/insurances';
export const FEE_SCHEDULES_URL = '/admin/fee-schedule';
export const CHARGE_MASTERS_URL = '/admin/charge-masters';
export const VIRTUAL_LOCATIONS_URL = '/admin/virtual-locations';
export const BILLING_URL = '/admin/billing';
export const BILLING_INSURANCE_URL = '/admin/billing/insurance';
export const PAYMENT_LOCATIONS_URL = '/admin/billing/payments/locations';
export const OUTREACH_URL = '/admin/outreach';
export const GLOBAL_TEMPLATES_URL = '/admin/global-templates';

const MUI_X_LICENSE_KEY = import.meta.env.VITE_APP_MUI_X_LICENSE_KEY;
if (MUI_X_LICENSE_KEY != null) {
  LicenseInfo.setLicenseKey(MUI_X_LICENSE_KEY);
}

export const showEnvironmentBanner = import.meta.env.VITE_APP_ENV !== 'production';

function App(): ReactElement {
  useApiClients();
  const currentUser = useEvolveUser();
  const currentTab = useNavStore((state) => state.currentTab) || 'Tracking Board';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);

  const handleOnIdle = (): void => {
    window.location.href = '/logout';
  };

  const handleOnPrompt = (): void => {
    setIsModalOpen(true);
    setTimeLeft(Math.ceil(getRemainingTime() / 1000));
  };

  const handleContinue = (): void => {
    setIsModalOpen(false);
    reset();
  };

  const handleEndSession = (): void => {
    setIsModalOpen(false);
    handleOnIdle();
  };

  const { reset, getRemainingTime } = useIdleTimer({
    timeout: 60 * 60 * 1000, // 60 minutes
    onIdle: handleOnIdle,
    onPrompt: handleOnPrompt,
    promptBeforeIdle: 1 * 60 * 1000, // 60 second warning
    debounce: 500,
  });

  const roleUnknown =
    !currentUser ||
    !currentUser.hasRole([
      RoleType.Administrator,
      RoleType.Staff,
      RoleType.Manager,
      RoleType.Provider,
      RoleType.CustomerSupport,
    ]);

  return (
    <CustomThemeProvider>
      <CssBaseline />
      <LogoutWarning
        modalOpen={isModalOpen}
        onEnd={handleEndSession}
        onContinue={handleContinue}
        timeoutInSeconds={timeLeft}
      />
      {showEnvironmentBanner && (
        <>
          <Banner
            text={`${import.meta.env.VITE_APP_ENV?.toUpperCase()} environment`}
            icon="warning"
            iconSize="medium"
            bgcolor="info.main"
            color="info.contrast"
          />
        </>
      )}
      <BrowserRouter>
        <Routes>
          <Route
            path="/in-person/:id/*"
            element={
              <ProtectedRoute
                showWhenAuthenticated={
                  <Suspense fallback={<LoadingScreen />}>
                    <InPersonRoutingLazy />
                  </Suspense>
                }
              />
            }
          />
          <Route
            element={
              <TabContext value={currentTab}>
                <Navbar />
                <ProtectedRoute
                  showWhenAuthenticated={
                    <Suspense fallback={<LoadingScreen />}>
                      <Outlet />
                    </Suspense>
                  }
                />
              </TabContext>
            }
          >
            {roleUnknown && (
              <>
                <Route path="/logout" element={<Logout />} />
                <Route path="*" element={<LoadingScreen />} />
              </>
            )}
            {currentUser?.hasRole([
              RoleType.Administrator,
              RoleType.Manager,
              RoleType.Staff,
              RoleType.Provider,
              RoleType.CustomerSupport,
            ]) && (
              <>
                <Route path="/reports" element={<Reports />} />
                <Route path="/reports/incomplete-encounters" element={<IncompleteEncounters />} />
                <Route path="/reports/complete-encounters" element={<CompleteEncounters />} />
                <Route path="/reports/daily-payments" element={<DailyPayments />} />
                <Route path="/reports/visits-overview" element={<VisitsOverview />} />
                <Route path="/reports/recent-patients" element={<RecentPatients />} />
              </>
            )}
            {currentUser?.hasRole([RoleType.Administrator, RoleType.CustomerSupport]) && (
              <Route path="/tasks-observability" element={<TaskAdmin />} />
            )}
            {currentUser?.hasRole([RoleType.Administrator]) && (
              <>
                <Route path="/reports/ai-assisted-encounters" element={<AiAssistedEncounters />} />
                <Route path="/reports/practice-kpis" element={<PracticeKpis />} />
                <Route path="/reports/data-exports" element={<DataExports />} />
                <Route path="/reports/invoiceable-patients" element={<InvoiceablePatientsReportPage />} />
                <Route path="/reports/mailed-statements" element={<MailedStatements />} />
              </>
            )}
            {currentUser?.hasRole([RoleType.Administrator, RoleType.Manager, RoleType.CustomerSupport]) && (
              <>
                <Route path="/" element={<Navigate to="/visits" />} />
                <Route path="/logout" element={<Logout />} />
                <Route path="/visits" element={<AppointmentsPage />} />
                <Route path="/visits/add" element={<AddPatient />} />
                <Route path="/visit/:id" element={<VisitDetailsPage />} />
                <Route path="/profile" element={<EmployeeProfilePage />} />
                <Route path="/patients" element={<PatientsPage />} />
                <Route path="/patient/:id" element={<PatientPage />} />
                <Route path="/patient/:id/info" element={<PatientInformationPage />} />
                <Route path="/patient/:id/docs" element={<PatientDocumentsExplorerPage />} />
                <Route path="/patient/:id/followup/add" element={<AddPatientFollowup />} />
                {FEATURE_FLAGS.LEGACY_PATIENT_FOLLOWUPS_ENABLED && (
                  <Route path="/patient/:id/followup/:encounterId" element={<PatientFollowup />} />
                )}
                <Route path="/admin" element={<AdminPage />} />
                <Route path={`${BILLING_URL}/:billingTab`} element={<AdminPage />} />
                <Route path={`${BILLING_URL}/:billingTab/:insuranceTab`} element={<AdminPage />} />
                <Route path={`${OUTREACH_URL}/:outreachSubTab`} element={<AdminPage />} />
                <Route path={`${OUTREACH_URL}/:outreachSubTab/:outreachDetailTab`} element={<AdminPage />} />
                <Route path="/admin/:adminTab" element={<AdminPage />} />
                <Route path="/admin/:adminTab/:subTab" element={<AdminPage />} />
                <Route path="/admin/quick-picks/procedure/:quickPickId" element={<ProcedureQuickPickDetailPage />} />
                <Route path="/admin/quick-picks/radiology/:quickPickId" element={<RadiologyQuickPickDetailPage />} />
                <Route
                  path="/admin/quick-picks/immunization/:quickPickId"
                  element={<ImmunizationQuickPickDetailPage />}
                />
                <Route
                  path="/admin/quick-picks/in-house-medication/:quickPickId"
                  element={<InHouseMedicationQuickPickDetailPage />}
                />
                <Route path="/admin/employees/add" element={<AddEmployeePage />} />
                <Route path="/admin/employee/:id" element={<EditEmployeePage />} />
                <Route path="/admin/schedule/:schedule-type/add" element={<AddSchedulePage />} />
                <Route path="/admin/group/id/:group-id" element={<GroupPage />} />
                <Route path="/admin/schedule/id/:schedule-id" element={<SchedulePage />} />
                <Route path="/admin/schedule/new/:schedule-type/:owner-id" element={<SchedulePage />} />
                <Route path="/admin/medications/add" element={<AddMedicationPage />} />
                <Route path="/admin/medication/:medication-id" element={<UpdateMedicationPage />} />
                <Route path={`${VIRTUAL_LOCATIONS_URL}/:id`} element={<EditVirtualLocationPage />} />
                <Route path={`${INSURANCES_URL}/:insuranceTab/:insurance`} element={<EditInsurance />} />
                <Route path={`${BILLING_URL}/:billingTab/:insuranceTab/:insurance`} element={<EditInsurance />} />
                <Route path={`${FEE_SCHEDULES_URL}/:id`} element={<EditChargeItem />} />
                <Route path={`${CHARGE_MASTERS_URL}/:id`} element={<EditChargeItem mode="charge-master" />} />
                <Route path={`${PAYMENT_LOCATIONS_URL}/:id`} element={<PaymentLocationDetailPage />} />
                <Route path={`${GLOBAL_TEMPLATES_URL}/:templateId`} element={<GlobalTemplateDetailPage />} />
                <Route path="/admin/in-house-labs/add" element={<AdminAddInHouseLab />} />
                <Route path="/admin/in-house-labs/:activityDefinitionId" element={<AdminInHouseLabDetails />} />
                <Route path="/admin/lab-sets/add" element={<AdminAddLabSet />} />
                <Route path="/admin/lab-sets/:listId" element={<AdminLabSetDetails />} />
                {FEATURE_FLAGS.LEGACY_DATA_ENABLED && <Route path="/legacy-data" element={<LegacyDataPage />} />}
                <Route path="/tasks" element={<Tasks />} />
                <Route path="*" element={<Navigate to={'/'} />} />
              </>
            )}
            {currentUser?.hasRole([RoleType.Staff, RoleType.Provider, RoleType.CustomerSupport]) && (
              <>
                <Route path="/" element={<Navigate to="/visits" />} />
                <Route path="/logout" element={<Logout />} />
                <Route path="/visits" element={<AppointmentsPage />} />
                <Route path="/visits/add" element={<AddPatient />} />
                <Route path="/visit/:id" element={<VisitDetailsPage />} />
                <Route path="/profile" element={<EmployeeProfilePage />} />
                <Route path="/patient/:id" element={<PatientPage />} />
                <Route path="/patient/:id/info" element={<PatientInformationPage />} />
                <Route path="/patient/:id/docs" element={<PatientDocumentsExplorerPage />} />
                <Route path="/patient/:id/followup/add" element={<AddPatientFollowup />} />
                {FEATURE_FLAGS.LEGACY_PATIENT_FOLLOWUPS_ENABLED && (
                  <Route path="/patient/:id/followup/:encounterId" element={<PatientFollowup />} />
                )}
                <Route path="/patients" element={<PatientsPage />} />

                <Route path="/unsolicited-results" element={<UnsolicitedResultsInbox />} />
                <Route path="/unsolicited-results/:diagnosticReportId/match" element={<UnsolicitedResultsMatch />} />
                <Route path="/unsolicited-results/:diagnosticReportId/review" element={<UnsolicitedResultsReview />} />

                {FEATURE_FLAGS.LEGACY_DATA_ENABLED && <Route path="/legacy-data" element={<LegacyDataPage />} />}
                <Route path="/tasks" element={<Tasks />} />
                <Route path="*" element={<Navigate to={'/'} />} />
              </>
            )}
          </Route>
          <Route path="/test-error" element={<TestErrorPage />} />
        </Routes>
        <CommandPaletteRegistrations />
        <CommandPalette />
        <SnackbarProvider maxSnack={5} autoHideDuration={6000} />
      </BrowserRouter>
    </CustomThemeProvider>
  );
}

export default App;
