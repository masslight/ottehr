import { ReactElement, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { CssBaseline, Box, CircularProgress } from '@mui/material';
import { TabContext } from '@mui/lab';
import { LicenseInfo } from '@mui/x-data-grid-pro';
import { useContext } from 'react';
import { IntakeDataContext } from './store/IntakeContext';
import { setUser } from './store/IntakeActions';
import { getUser } from './api/api';
import { RoleType } from './types/types';
import { compareRoles } from './helpers/compareRoles';
import Navbar from './components/navigation/Navbar';
import Footer from './components/Footer';
import AppointmentsPage from './pages/Appointments';
import Logout from './pages/Logout';
import { CustomThemeProvider } from './CustomThemeProvider';
import IntakeFlow from './components/IntakeFlow';
import LocationsPage from './pages/Offices';
import EmployeesPage from './pages/Employees';
import EditEmployeePage from './pages/EditEmployee';
import LocationPage from './pages/Office';
import AddPatient from './pages/AddPatient';
import AppointmentPage from './pages/AppointmentPage';

const MUI_X_LICENSE_KEY = import.meta.env.VITE_APP_MUI_X_LICENSE_KEY;
if (MUI_X_LICENSE_KEY != null) {
  LicenseInfo.setLicenseKey(MUI_X_LICENSE_KEY);
}

function App(): ReactElement {
  const { isAuthenticated, isLoading, loginWithRedirect, getAccessTokenSilently } = useAuth0();
  const { dispatch } = useContext(IntakeDataContext);
  const [currentTab, setCurrentTab] = useState('Tracking Board');
  const [role, setRole] = useState<RoleType>();

  if (!isAuthenticated && !isLoading) {
    loginWithRedirect().catch((error) => {
      throw new Error(`Error calling loginWithRedirect Auth0 ${error}`);
    });
  }

  useEffect(() => {
    async function getUserRole(): Promise<void> {
      const accessToken = await getAccessTokenSilently();
      const user = await getUser(accessToken);
      setUser(user, dispatch);
      if (compareRoles((user as any).roles[0].name, RoleType.Manager)) {
        setRole(RoleType.Manager);
      } else if (compareRoles((user as any).roles[0].name, RoleType.FrontDesk)) {
        setRole(RoleType.FrontDesk);
      } else if (compareRoles((user as any).roles[0].name, RoleType.Staff)) {
        setRole(RoleType.Staff);
      } else if (compareRoles((user as any).roles[0].name, RoleType.Provider)) {
        setRole(RoleType.Provider);
      }
    }

    if (isAuthenticated) {
      getUserRole().catch((error) => {
        console.log(error);
      });
    }
  }, [dispatch, getAccessTokenSilently, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  console.log('role:', role);

  return (
    <CustomThemeProvider>
      <CssBaseline />
      {/* <div className="app"> */}
      <BrowserRouter>
        <TabContext value={currentTab}>
          <Navbar setCurrentTab={setCurrentTab} />
          {!role && (
            <Routes>
              <Route path="/" element={<IntakeFlow />}>
                <Route path="/logout" element={<Logout />} />
              </Route>
            </Routes>
          )}
          {(role === RoleType.Manager || role === RoleType.FrontDesk) && (
            <Routes>
              <Route path="/" element={<IntakeFlow />}>
                <Route path="/" element={<Navigate to="/appointments" />} />
                <Route path="/logout" element={<Logout />} />
                <Route path="/appointments" element={<AppointmentsPage />} />
                <Route path="/appointments/add" element={<AddPatient />} />
                <Route path="/appointment/:id" element={<AppointmentPage />} />
                <Route path="/offices" element={<LocationsPage />} />
                <Route path="/office/:id" element={<LocationPage />} />
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/employee/:id" element={<EditEmployeePage />} />
              </Route>
            </Routes>
          )}
          {(role === RoleType.Staff || role === RoleType.Provider) && (
            <Routes>
              <Route path="/" element={<IntakeFlow />}>
                <Route path="/" element={<Navigate to="/appointments" />} />
                <Route path="/logout" element={<Logout />} />
                <Route path="/appointments" element={<AppointmentsPage />} />
                <Route path="/appointment/:id" element={<AppointmentPage />} />
              </Route>
            </Routes>
          )}
          <Footer />
        </TabContext>
      </BrowserRouter>
    </CustomThemeProvider>
  );
}

export default App;
