import { TabContext } from '@mui/lab';
import { CssBaseline } from '@mui/material';
// import Alert from '@mui/material/Alert';
import { LicenseInfo } from '@mui/x-data-grid-pro';
import { SnackbarProvider } from 'notistack';
import { ReactElement, Suspense, lazy, useState } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { RoleType } from 'utils';
import { CustomThemeProvider } from './CustomThemeProvider';
import { LoadingScreen } from './components/LoadingScreen';
import Navbar from './components/navigation/Navbar';
import { ProtectedRoute } from './components/routing/ProtectedRoute';
import { useApiClients } from './hooks/useAppClients';
import useEvolveUser, { useProviderPhotonStateStore } from './hooks/useEvolveUser';
import AddPatient from './pages/AddPatient';
import AppointmentPage from './pages/AppointmentPage';
import AppointmentsPage from './pages/Appointments';
import Data from './pages/Data';
import EditEmployeePage from './pages/EditEmployee';
import EmployeesPage from './pages/Employees';
import Logout from './pages/Logout';
import PatientPage from './pages/PatientPage';
import PatientInformationPage from './pages/PatientInformationPage';
import PatientsPage from './pages/Patients';
import { TelemedAdminPage } from './pages/TelemedAdminPage';
import { useNavStore } from './state/nav.store';
import { PatientVisitDetails } from './telemed/pages/PatientVisitDetailsPage';
import EditInsurance from './telemed/features/telemed-admin/EditInsurance';
import EditStatePage from './telemed/features/telemed-admin/EditState';
import { useIdleTimer } from 'react-idle-timer';
import LogoutWarning from './components/dialogs/LogoutWarning';
import Banner from './components/Banner';
import { Claims, Claim } from './rcm';
import { FeatureFlagsProvider } from './features/css-module/context/featureFlags';
import PatientDocumentsExplorerPage from './pages/PatientDocumentsExplorerPage';
import PatientFollowup from './components/patient/PatientFollowup';
import AddPatientFollowup from './components/patient/AddPatientFollowup';
import SchedulePage from './pages/Schedule';
import SchedulesPage from './pages/Schedules';
import AddSchedulePage from './pages/AddSchedulePage';
import('@photonhealth/elements').catch(console.log);

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

  const wasEnrolledInphoton = useProviderPhotonStateStore((state) => state.wasEnrolledInphoton);

  const roleUnknown =
    !currentUser || !currentUser.hasRole([RoleType.Administrator, RoleType.Staff, RoleType.Manager, RoleType.Provider]);

  // CI_PHOTON_DISABLED is used to disable photon in testing CI environments, because photon refresh the dashboard page and breaks the tests
  // we may use sleep + page.refresh() and other workarounds, but better to run photon tests separately and don't affect other tests
  const photonDisadledByEnv = import.meta.env.VITE_APP_CI_PHOTON_DISABLED === 'true';
  const photonEnabledForUser = currentUser?.hasRole([RoleType.Provider]) && currentUser.isPractitionerEnrolledInPhoton;
  const shouldUsePhoton = !photonDisadledByEnv && (photonEnabledForUser || wasEnrolledInphoton);

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
                      {shouldUsePhoton ? (
                        <photon-client
                          id={import.meta.env.VITE_APP_PHOTON_CLIENT_ID}
                          org={import.meta.env.VITE_APP_PHOTON_ORG_ID}
                          dev-mode={import.meta.env.MODE === 'production' ? 'false' : 'true'}
                          auto-login="true"
                          redirect-uri={window.location.origin}
                        >
                          <CSSRoutingLazy />
                        </photon-client>
                      ) : (
                        <CSSRoutingLazy />
                      )}
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
                        {shouldUsePhoton ? (
                          <photon-client
                            id={import.meta.env.VITE_APP_PHOTON_CLIENT_ID}
                            org={import.meta.env.VITE_APP_PHOTON_ORG_ID}
                            dev-mode={import.meta.env.MODE === 'production' ? 'false' : 'true'}
                            auto-login="true"
                            redirect-uri={window.location.origin}
                          >
                            <Outlet />
                          </photon-client>
                        ) : (
                          <Outlet />
                        )}
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
                  <Route path="/schedule/:schedule-type/:id" element={<SchedulePage />} />
                  <Route path="/employees" element={<EmployeesPage />} />
                  <Route path="/employee/:id" element={<EditEmployeePage />} />
                  <Route path="/patients" element={<PatientsPage />} />
                  <Route path="/patient/:id" element={<PatientPage />} />
                  <Route path="/patient/:id/info" element={<PatientInformationPage />} />
                  <Route path="/patient/:id/details" element={<PatientVisitDetails />} />
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
          </Routes>
          <SnackbarProvider maxSnack={5} autoHideDuration={6000} />
        </BrowserRouter>
      </FeatureFlagsProvider>
    </CustomThemeProvider>
  );
}

export default App;
