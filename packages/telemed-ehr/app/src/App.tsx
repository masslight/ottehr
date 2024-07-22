import { TabContext } from '@mui/lab';
import { CssBaseline } from '@mui/material';
import { LicenseInfo } from '@mui/x-data-grid-pro';
import { ReactElement, Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { CustomThemeProvider } from './CustomThemeProvider';
import { LoadingScreen } from './components/LoadingScreen';
import Navbar from './components/navigation/Navbar';
import { ProtectedRoute } from './components/routing/ProtectedRoute';
import { useApiClients } from './hooks/useAppClients';
import useOttehrUser from './hooks/useOttehrUser';
import AddPatient from './pages/AddPatient';
import AppointmentsPage from './pages/Appointments';
import EditEmployeePage from './pages/EditEmployee';
import EmployeesPage from './pages/Employees';
import Logout from './pages/Logout';
import SchedulePage from './pages/Schedule';
import SchedulesPage from './pages/Schedules';
import PatientInformationPage from './pages/PatientInformationPage';
import PatientsPage from './pages/Patients';
import { TelemedAdminPage } from './pages/TelemedAdminPage';
import { useNavStore } from './state/nav.store';
import EditInsurance from './telemed/features/telemed-admin/EditInsurance';
import EditStatePage from './telemed/features/telemed-admin/EditState';
import { isLocalOrDevOrTestingOrTrainingEnv } from './telemed/utils/env.helper';
import { RoleType } from './types/types';
import { AppointmentPage } from './pages/AppointmentPage';
import AddSchedulePage from './pages/AddSchedulePage';

const enablePhoton = false && isLocalOrDevOrTestingOrTrainingEnv;

if (enablePhoton) {
  import('@photonhealth/elements').catch(console.log);
}

const TelemedTrackingBoardPageLazy = lazy(async () => {
  const TrackingBoardPage = await import('./telemed/pages/TrackingBoardPage');
  return { default: TrackingBoardPage.TrackingBoardPage };
});

const TelemedAppointmentPageLazy = lazy(async () => {
  const TelemedAppointmentPage = await import('./telemed/pages/AppointmentPage');
  return { default: TelemedAppointmentPage.AppointmentPage };
});

export const INSURANCES_PATH = '/telemed-admin/insurances';

const MUI_X_LICENSE_KEY = import.meta.env.VITE_APP_MUI_X_LICENSE_KEY;
if (MUI_X_LICENSE_KEY != null) {
  LicenseInfo.setLicenseKey(MUI_X_LICENSE_KEY);
}

function App(): ReactElement {
  useApiClients();
  const currentUser = useOttehrUser();
  const currentTab = useNavStore((state: any) => state.currentTab) || 'In Person';

  const roleUnknown =
    !currentUser || !currentUser.hasRole([RoleType.Administrator, RoleType.Staff, RoleType.Manager, RoleType.Provider]);

  return (
    <CustomThemeProvider>
      <CssBaseline />
      <BrowserRouter>
        <TabContext value={currentTab}>
          <Navbar />
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute
                  showWhenAuthenticated={
                    <>
                      {currentUser?.hasRole([RoleType.Provider]) && enablePhoton ? (
                        <photon-client
                          id={import.meta.env.VITE_APP_PHOTON_CLIENT_ID}
                          org={import.meta.env.VITE_APP_PHOTON_ORG_ID}
                          dev-mode="true"
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
              }
            >
              {roleUnknown && (
                <>
                  <Route path="/logout" element={<Logout />} />
                  <Route path="*" element={<LoadingScreen />} />
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
                  <Route path="/patient/:id" element={<PatientInformationPage />} />
                  <Route path="/telemed-admin" element={<Navigate to={INSURANCES_PATH} />} />
                  <Route path="/telemed-admin/states" element={<TelemedAdminPage />} />
                  <Route path="/telemed-admin/states/:state" element={<EditStatePage />} />
                  <Route path={INSURANCES_PATH} element={<TelemedAdminPage />} />
                  <Route path={`${INSURANCES_PATH}/:insurance`} element={<EditInsurance />} />
                  <Route path="*" element={<Navigate to={'/'} />} />
                </>
              )}
              {currentUser?.hasRole([RoleType.Administrator, RoleType.Provider]) && (
                <>
                  <Route path="/" element={<Navigate to="/visits" />} />
                  <Route path="/logout" element={<Logout />} />
                  <Route path="/visits" element={<AppointmentsPage />} />
                  <Route path="/visits/add" element={<AddPatient />} />
                  <Route path="/patient/:id" element={<PatientInformationPage />} />
                  <Route path="/patients" element={<PatientsPage />} />
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
        </TabContext>
      </BrowserRouter>
    </CustomThemeProvider>
  );
}

export default App;
