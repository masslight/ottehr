import { TabContext } from '@mui/lab';
import { CssBaseline } from '@mui/material';
import { LicenseInfo } from '@mui/x-data-grid-pro';
import { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CustomThemeProvider } from './CustomThemeProvider';
import { LoadingScreen } from './components/LoadingScreen';
import Navbar from './components/navigation/Navbar';
import { ProtectedRoute } from './components/routing/ProtectedRoute';
import { useApiClients } from './hooks/useAppClients';
import { useGetUser } from './hooks/useGetUser';
import { useUserRole } from './hooks/useUserRole';
import AddPatient from './pages/AddPatient';
import AppointmentsPage from './pages/Appointments';
import Data from './pages/Data';
import EditEmployeePage from './pages/EditEmployee';
import EmployeesPage from './pages/Employees';
import Logout from './pages/Logout';
import LocationPage from './pages/Office';
import LocationsPage from './pages/Offices';
import PatientInformationPage from './pages/PatientInformationPage';
import PatientsPage from './pages/Patients';
import { useNavStore } from './state/nav.store';
import { AppointmentPage as TelemedAppointmentPage, TrackingBoardPage } from './telemed';
import { RoleType } from './types/types';

const MUI_X_LICENSE_KEY = import.meta.env.VITE_APP_MUI_X_LICENSE_KEY;
if (MUI_X_LICENSE_KEY != null) {
  LicenseInfo.setLicenseKey(MUI_X_LICENSE_KEY);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function App(): ReactElement {
  useApiClients();
  useGetUser();
  const role = useUserRole();
  const currentTab = useNavStore((state) => state.currentTab) || 'Urgent Care';

  return (
    <QueryClientProvider client={queryClient}>
      <CustomThemeProvider>
        <CssBaseline />
        {/* <div className="app"> */}
        <BrowserRouter>
          <TabContext value={currentTab}>
            <Navbar />
            <Routes>
              <Route path="/" element={<ProtectedRoute />}>
                {!role && (
                  <>
                    <Route path="/logout" element={<Logout />} />
                    <Route path="*" element={<LoadingScreen />} />
                  </>
                )}
                {(role === RoleType.Administrator || role === RoleType.Manager) && (
                  <>
                    <Route path="/" element={<Navigate to="/visits" />} />
                    <Route path="/logout" element={<Logout />} />
                    <Route path="/visits" element={<AppointmentsPage />} />
                    <Route path="/visits/add" element={<AddPatient />} />
                    <Route path="/offices" element={<LocationsPage />} />
                    <Route path="/office/:id" element={<LocationPage />} />
                    <Route path="/employees" element={<EmployeesPage />} />
                    <Route path="/employee/:id" element={<EditEmployeePage />} />
                    <Route path="/patients" element={<PatientsPage />} />
                    <Route path="/data" element={<Data />} />
                    <Route path="/patient/:id" element={<PatientInformationPage />} />
                    {/** telemed */}
                    <Route path="/telemed/appointments" element={<TrackingBoardPage />} />
                    <Route path="/telemed/appointments/:id" element={<TelemedAppointmentPage />} />
                    <Route path="*" element={<Navigate to={'/'} />} />
                  </>
                )}
                {(role === RoleType.Staff || role === RoleType.Provider) && (
                  <>
                    <Route path="/" element={<Navigate to="/visits" />} />
                    <Route path="/logout" element={<Logout />} />
                    <Route path="/visits" element={<AppointmentsPage />} />
                    <Route path="/visits/add" element={<AddPatient />} />
                    <Route path="/patient/:id" element={<PatientInformationPage />} />
                    <Route path="/patients" element={<PatientsPage />} />
                    {/** telemed */}
                    <Route path="/telemed/appointments" element={<TrackingBoardPage />} />
                    <Route path="/telemed/appointments/:id" element={<TelemedAppointmentPage />} />
                    <Route path="*" element={<Navigate to={'/'} />} />
                  </>
                )}
              </Route>
            </Routes>
          </TabContext>
        </BrowserRouter>
      </CustomThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
