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
import AddPatientFollowup from './components/patient/AddPatientFollowup';
import PatientFollowup from './components/patient/PatientFollowup';
import { ProtectedRoute } from './components/routing/ProtectedRoute';
import { TestErrorPage } from './components/TestErrorPage';
import { CustomThemeProvider } from './CustomThemeProvider';
import { FeatureFlagsProvider } from './features/css-module/context/featureFlags';
import { useApiClients } from './hooks/useAppClients';
import useEvolveUser from './hooks/useEvolveUser';
import AddEmployeePage from './pages/AddEmployeePage';
import AddPatient from './pages/AddPatient';
import AddSchedulePage from './pages/AddSchedulePage';
import AppointmentPage from './pages/AppointmentPage';
import AppointmentsPage from './pages/Appointments';
import Data from './pages/Data';
import EditEmployeePage from './pages/EditEmployee';
import EmployeesPage from './pages/Employees';
import GroupPage from './pages/GroupPage';
import Logout from './pages/Logout';
import PatientDocumentsExplorerPage from './pages/PatientDocumentsExplorerPage';
import PatientInformationPage from './pages/PatientInformationPage';
import PatientPage from './pages/PatientPage';
import PatientsPage from './pages/Patients';
import SchedulePage from './pages/SchedulePage';
import SchedulesPage from './pages/Schedules';
import { TelemedAdminPage } from './pages/TelemedAdminPage';
import { Claim, Claims } from './rcm';
import { useNavStore } from './state/nav.store';
import EditInsurance from './telemed/features/telemed-admin/EditInsurance';
import EditStatePage from './telemed/features/telemed-admin/EditState';
import { PatientVisitDetails } from './telemed/pages/PatientVisitDetailsPage';

const { MODE: environment, VITE_APP_SENTRY_DSN } = import.meta.env;

const isLowerEnvs = ['dev', 'testing', 'staging', 'training'].includes(environment);

const isLowerEnvsOrProd = isLowerEnvs || import.meta.env.MODE === 'production';

if (isLowerEnvsOrProd) {
  setupSentry({
    dsn: VITE_APP_SENTRY_DSN,
    environment,
  });
}

const CSSRoutingLazy = lazy(() => import('./features/css-module/routing/CSSRouting'));

const TelemedTrackingBoardPageLazy = lazy(async () => {
  const TrackingBoardPage = await import('./telemed/pages/TrackingBoardPage');
  return { default: TrackingBoardPage.TrackingBoardPage };
});

const TelemedAppointmentPageLazy = lazy(async () => {
  const TelemedAppointmentPage = await import('./telemed/pages/AppointmentPage');
  return { default: TelemedAppointmentPage.AppointmentPage };
});

export const INSURANCES_URL = '/telemed-admin/insurances';
export const STATES_URL = '/telemed-admin/states';

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
    !currentUser || !currentUser.hasRole([RoleType.Administrator, RoleType.Staff, RoleType.Manager, RoleType.Provider]);

  return (
    <CustomThemeProvider>
      <FeatureFlagsProvider>
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
                      <CSSRoutingLazy />
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
              {currentUser?.hasRole([RoleType.Administrator]) && (
                <>
                  <Route path="/data" element={<Data />} />
                </>
              )}
              {currentUser?.hasRole([RoleType.Administrator, RoleType.Manager]) && (
                <>
                  <Route path="/" element={<Navigate to="/visits" />} />
                  <Route path="/logout" element={<Logout />} />
                  <Route path="/visits" element={<AppointmentsPage />} />
                  <Route path="/visits/add" element={<AddPatient />} />
                  <Route path="/visit/:id" element={<AppointmentPage />} />
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
                  <Route path={`${STATES_URL}`} element={<TelemedAdminPage />} />
                  <Route path={`${STATES_URL}/:state`} element={<EditStatePage />} />
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
                  <Route path="*" element={<Navigate to={'/'} />} />
                </>
              )}
              {currentUser?.hasRole([RoleType.Staff, RoleType.Provider]) && (
                <>
                  <Route path="/" element={<Navigate to="/visits" />} />
                  <Route path="/logout" element={<Logout />} />
                  <Route path="/visits" element={<AppointmentsPage />} />
                  <Route path="/visits/add" element={<AddPatient />} />
                  <Route path="/visit/:id" element={<AppointmentPage />} />
                  <Route path="/patient/:id" element={<PatientPage />} />
                  <Route path="/patient/:id/info" element={<PatientInformationPage />} />
                  <Route path="/patient/:id/details" element={<PatientVisitDetails />} />
                  <Route path="/patient/:id/docs" element={<PatientDocumentsExplorerPage />} />
                  <Route path="/patient/:id/followup/add" element={<AddPatientFollowup />} />
                  <Route path="/patient/:id/followup/:encounterId" element={<PatientFollowup />} />
                  <Route path="/patients" element={<PatientsPage />} />

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
                  <Route
                    path="/telemed/appointments/:id"
                    element={
                      <Suspense fallback={<LoadingScreen />}>
                        <TelemedAppointmentPageLazy />
                      </Suspense>
                    }
                  />
                  <Route path="*" element={<Navigate to={'/'} />} />
                </>
              )}
            </Route>
            <Route path="/test-error" element={<TestErrorPage />} />
          </Routes>
          <SnackbarProvider maxSnack={5} autoHideDuration={6000} />
        </BrowserRouter>
      </FeatureFlagsProvider>
    </CustomThemeProvider>
  );
}

export default App;
