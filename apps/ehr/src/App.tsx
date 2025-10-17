import { TabContext } from '@mui/lab';
import { CssBaseline } from '@mui/material';
// import Alert from '@mui/material/Alert';
import { LicenseInfo } from '@mui/x-data-grid-pro';
import { SnackbarProvider } from 'notistack';
import { lazy, ReactElement, Suspense, useState } from 'react';
import { useIdleTimer } from 'react-idle-timer';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { RoleType, setupSentry } from 'utils';
import Banner from './components/Banner';
import LogoutWarning from './components/dialogs/LogoutWarning';
import { LoadingScreen } from './components/LoadingScreen';
import Navbar from './components/navigation/Navbar';
import { ProtectedRoute } from './components/routing/ProtectedRoute';
import { TestErrorPage } from './components/TestErrorPage';
import { CustomThemeProvider } from './CustomThemeProvider';
import { UnsolicitedResultsInbox } from './features/external-labs/pages/UnsolicitedResultsInbox';
import { UnsolicitedResultsMatch } from './features/external-labs/pages/UnsolicitedResultsMatch';
import { UnsolicitedResultsReview } from './features/external-labs/pages/UnsolicitedResultsReview';
import { Tasks } from './features/tasks/pages/Tasks';
import AddPatientFollowup from './features/visits/shared/components/patient/AddPatientFollowup';
import PatientFollowup from './features/visits/shared/components/patient/PatientFollowup';
import { AppFlagsProvider } from './features/visits/shared/stores/contexts/useAppFlags';
import EditInsurance from './features/visits/telemed/components/telemed-admin/EditInsurance';
import EditVirtualLocationPage from './features/visits/telemed/components/telemed-admin/EditVirtualLocationPage';
import { PatientVisitDetails } from './features/visits/telemed/pages/PatientVisitDetailsPage';
import { useApiClients } from './hooks/useAppClients';
import useEvolveUser from './hooks/useEvolveUser';
import AddEmployeePage from './pages/AddEmployeePage';
import AddPatient from './pages/AddPatient';
import AddSchedulePage from './pages/AddSchedulePage';
import AppointmentsPage from './pages/Appointments';
import EditEmployeePage from './pages/EditEmployee';
import EmployeesPage from './pages/Employees';
import GroupPage from './pages/GroupPage';
import Logout from './pages/Logout';
import PatientDocumentsExplorerPage from './pages/PatientDocumentsExplorerPage';
import PatientInformationPage from './pages/PatientInformationPage';
import PatientPage from './pages/PatientPage';
import PatientsPage from './pages/Patients';
import Reports from './pages/Reports';
import {
  DailyPayments,
  DataExports,
  IncompleteEncounters,
  InvoiceablePatients,
  VisitsOverview,
  WorkflowEfficiency,
} from './pages/reports/index';
import SchedulePage from './pages/SchedulePage';
import SchedulesPage from './pages/Schedules';
import TaskAdmin from './pages/TaskAdmin';
import { TelemedAdminPage } from './pages/TelemedAdminPage';
import VisitDetailsPage from './pages/VisitDetailsPage';
import { Claim, Claims } from './rcm';
import { useNavStore } from './state/nav.store';

const { VITE_APP_SENTRY_DSN, VITE_APP_SENTRY_ENV } = import.meta.env;

setupSentry({
  dsn: VITE_APP_SENTRY_DSN,
  environment: VITE_APP_SENTRY_ENV,
});

const InPersonRoutingLazy = lazy(() => import('./features/visits/in-person/routing/InPersonRouting'));

const TelemedTrackingBoardPageLazy = lazy(async () => {
  const TrackingBoardPage = await import('./features/visits/telemed/pages/TrackingBoardPage');
  return { default: TrackingBoardPage.TrackingBoardPage };
});

const TelemedAppointmentPageLazy = lazy(async () => {
  const TelemedAppointmentPage = await import('./features/visits/telemed/pages/AppointmentPage');
  return { default: TelemedAppointmentPage.AppointmentPage };
});

export const INSURANCES_URL = '/telemed-admin/insurances';
export const VIRTUAL_LOCATIONS_URL = '/telemed-admin/virtual-locations';

const MUI_X_LICENSE_KEY = import.meta.env.VITE_APP_MUI_X_LICENSE_KEY;
if (MUI_X_LICENSE_KEY != null) {
  LicenseInfo.setLicenseKey(MUI_X_LICENSE_KEY);
}

export const showEnvironmentBanner = import.meta.env.VITE_APP_ENV !== 'production';

function App(): ReactElement {
  useApiClients();
  const currentUser = useEvolveUser();
  const currentTab = useNavStore((state) => state.currentTab) || 'In Person';
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
      <AppFlagsProvider>
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
                      <>
                        <Outlet />
                      </>
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
              {currentUser?.hasRole([RoleType.Administrator, RoleType.CustomerSupport]) && (
                <>
                  <Route path="/tasks" element={<TaskAdmin />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/reports/incomplete-encounters" element={<IncompleteEncounters />} />
                  <Route path="/reports/daily-payments" element={<DailyPayments />} />
                  <Route path="/reports/data-exports" element={<DataExports />} />
                  <Route path="/reports/workflow-efficiency" element={<WorkflowEfficiency />} />
                  <Route path="/reports/visits-overview" element={<VisitsOverview />} />
                  <Route path="/reports/invoiceable-patients" element={<InvoiceablePatients />} />
                </>
              )}
              {currentUser?.hasRole([RoleType.Administrator, RoleType.Manager, RoleType.CustomerSupport]) && (
                <>
                  <Route path="/" element={<Navigate to="/visits" />} />
                  <Route path="/logout" element={<Logout />} />
                  <Route path="/visits" element={<AppointmentsPage />} />
                  <Route path="/visits/add" element={<AddPatient />} />
                  <Route path="/visit/:id" element={<VisitDetailsPage />} />
                  <Route path="/schedules" element={<SchedulesPage />} />
                  <Route path="/schedule/:schedule-type/add" element={<AddSchedulePage />} />
                  <Route path="/group/id/:group-id" element={<GroupPage />} />
                  <Route path="/schedule/id/:schedule-id" element={<SchedulePage />} />
                  <Route path="/schedule/new/:schedule-type/:owner-id" element={<SchedulePage />} />
                  <Route path="/employees" element={<EmployeesPage />} />
                  <Route path="/employees/add" element={<AddEmployeePage />} />
                  <Route path="/employee/:id" element={<EditEmployeePage />} />
                  <Route path="/patients" element={<PatientsPage />} />
                  <Route path="/patient/:id" element={<PatientPage />} />
                  <Route path="/patient/:id/info" element={<PatientInformationPage />} />
                  <Route path="/patient/:id/details" element={<PatientVisitDetails />} />
                  <Route path="/patient/:id/docs" element={<PatientDocumentsExplorerPage />} />
                  <Route path="/patient/:id/followup/add" element={<AddPatientFollowup />} />
                  <Route path="/patient/:id/followup/:encounterId" element={<PatientFollowup />} />
                  <Route path="/telemed-admin" element={<Navigate to={INSURANCES_URL} />} />
                  <Route path={`${VIRTUAL_LOCATIONS_URL}`} element={<TelemedAdminPage />} />
                  <Route path={`${VIRTUAL_LOCATIONS_URL}/:id`} element={<EditVirtualLocationPage />} />
                  <Route path={INSURANCES_URL} element={<TelemedAdminPage />} />
                  <Route path={`${INSURANCES_URL}/:insurance`} element={<EditInsurance />} />
                  {/** telemed */}
                  <Route
                    path="/telemed/appointments"
                    element={
                      <Suspense fallback={<LoadingScreen />}>
                        <TelemedTrackingBoardPageLazy />
                      </Suspense>
                    }
                  ></Route>
                  <Route
                    path="/telemed/appointments/:id"
                    element={
                      <Suspense fallback={<LoadingScreen />}>
                        <TelemedAppointmentPageLazy />
                      </Suspense>
                    }
                  />
                  <Route path="/tasks-list" element={<Tasks />} />
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
                  <Route path="/patient/:id" element={<PatientPage />} />
                  <Route path="/patient/:id/info" element={<PatientInformationPage />} />
                  <Route path="/patient/:id/details" element={<PatientVisitDetails />} />
                  <Route path="/patient/:id/docs" element={<PatientDocumentsExplorerPage />} />
                  <Route path="/patient/:id/followup/add" element={<AddPatientFollowup />} />
                  <Route path="/patient/:id/followup/:encounterId" element={<PatientFollowup />} />
                  <Route path="/patients" element={<PatientsPage />} />

                  <Route path="/unsolicited-results" element={<UnsolicitedResultsInbox />} />
                  <Route path="/unsolicited-results/:diagnosticReportId/match" element={<UnsolicitedResultsMatch />} />
                  <Route
                    path="/unsolicited-results/:diagnosticReportId/review"
                    element={<UnsolicitedResultsReview />}
                  />

                  <Route path="/rcm/claims" element={<Claims />} />
                  <Route path="/rcm/claims/:id" element={<Claim />} />
                  {/** telemed */}
                  <Route
                    path="/telemed/appointments"
                    element={
                      <Suspense fallback={<LoadingScreen />}>
                        <TelemedTrackingBoardPageLazy />
                      </Suspense>
                    }
                  ></Route>
                  <Route path="/telemed/appointments/:id/visit-details" element={<VisitDetailsPage />} />
                  <Route
                    path="/telemed/appointments/:id"
                    element={
                      <Suspense fallback={<LoadingScreen />}>
                        <TelemedAppointmentPageLazy />
                      </Suspense>
                    }
                  />
                  <Route path="/tasks-list" element={<Tasks />} />
                  <Route path="*" element={<Navigate to={'/'} />} />
                </>
              )}
            </Route>
            <Route path="/test-error" element={<TestErrorPage />} />
          </Routes>
          <SnackbarProvider maxSnack={5} autoHideDuration={6000} />
        </BrowserRouter>
      </AppFlagsProvider>
    </CustomThemeProvider>
  );
}

export default App;
