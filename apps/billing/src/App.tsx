import { useAuth0 } from '@auth0/auth0-react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { LicenseInfo } from '@mui/x-data-grid-pro';
import { SnackbarProvider } from 'notistack';
import { ReactElement } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { RoleType } from 'utils';
import { Layout } from './components/Layout';
import { LoadingScreen } from './components/LoadingScreen';
import { ProtectedRoute } from './components/ProtectedRoute';
import { UnauthorizedPage } from './components/UnauthorizedPage';
import { ChargeItemDefinitionLabels } from './constants/chargeItemDefinition';
import { useApiClients } from './hooks/useAppClients';
import { useEvolveUser } from './hooks/useEvolveUser';
import { BillingProviderDetail, BillingProvidersList } from './pages/BillingProviders';
import { ChargeItemDefinitionDetail, ChargeItemDefinitionList } from './pages/ChargeItemDefinitionsList';
import ClaimDetail from './pages/ClaimDetail';
import ClaimsList from './pages/ClaimsList';
import CreateClaim from './pages/CreateClaim';
import Dashboard from './pages/Dashboard';
import ERADetail from './pages/ERADetail';
import ERAList from './pages/ERAList';
import PatientDetail from './pages/PatientDetail';
import PatientsList from './pages/PatientsList';
import { RenderingProviderDetail, RenderingProvidersList } from './pages/RenderingProviders';
import { ServiceFacilitiesList, ServiceFacilityDetail } from './pages/ServiceFacilities';
import Tags from './pages/Tags';
import { theme } from './themes/ottehr';

const MUI_X_LICENSE_KEY = import.meta.env.VITE_APP_MUI_X_LICENSE_KEY;
if (MUI_X_LICENSE_KEY) LicenseInfo.setLicenseKey(MUI_X_LICENSE_KEY);

export default function App(): ReactElement {
  useApiClients();
  const { logout } = useAuth0();
  const { currentUser, isLoadingUser } = useEvolveUser();

  const handleLogout = (): void => {
    void logout({ logoutParams: { returnTo: window.location.origin } });
  };

  const roleUnknown = !currentUser || !currentUser.hasRole([RoleType.Administrator, RoleType.BillingAdmin]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {isLoadingUser && <LoadingScreen />}
      <BrowserRouter>
        <Routes>
          {!isLoadingUser && roleUnknown && (
            <Route
              path="*"
              element={<ProtectedRoute showWhenAuthenticated={<UnauthorizedPage onLogout={handleLogout} />} />}
            />
          )}
          {!isLoadingUser && !roleUnknown && (
            <Route
              element={
                <ProtectedRoute
                  showWhenAuthenticated={
                    <Layout>
                      <Outlet />
                    </Layout>
                  }
                />
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/claims" element={<ClaimsList />} />
              <Route path="/claims/new" element={<CreateClaim />} />
              <Route path="/claims/:id" element={<ClaimDetail />} />
              <Route path="/patients" element={<PatientsList />} />
              <Route path="/patients/:id" element={<PatientDetail />} />
              <Route path="/billing-providers" element={<BillingProvidersList />} />
              <Route path="/billing-providers/:id" element={<BillingProviderDetail />} />
              <Route path="/rendering-providers" element={<RenderingProvidersList />} />
              <Route path="/rendering-providers/:id" element={<RenderingProviderDetail />} />
              <Route path="/service-facilities" element={<ServiceFacilitiesList />} />
              <Route path="/service-facilities/:id" element={<ServiceFacilityDetail />} />
              <Route
                path={`/${ChargeItemDefinitionLabels['charge-master'].pathComponent}`}
                element={<ChargeItemDefinitionList type="charge-master" />}
              />
              <Route
                path={`/${ChargeItemDefinitionLabels['charge-master'].pathComponent}/:id`}
                element={<ChargeItemDefinitionDetail type="charge-master" />}
              />
              <Route path="/eras" element={<ERAList />} />
              <Route path="/eras/:id" element={<ERADetail />} />
              <Route path="/tags" element={<Tags />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Route>
          )}
        </Routes>
        <SnackbarProvider maxSnack={5} autoHideDuration={6000} />
      </BrowserRouter>
    </ThemeProvider>
  );
}
