import { CssBaseline, ThemeProvider } from '@mui/material';
import { LicenseInfo } from '@mui/x-data-grid-pro';
import { SnackbarProvider } from 'notistack';
import { ReactElement } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useApiClients } from './hooks/useAppClients';
import { BillingProviderDetail, BillingProvidersList } from './pages/BillingProviders';
import ClaimDetail from './pages/ClaimDetail';
import ClaimsList from './pages/ClaimsList';
import CreateClaim from './pages/CreateClaim';
import Dashboard from './pages/Dashboard';
import PatientDetail from './pages/PatientDetail';
import PatientsList from './pages/PatientsList';
import { RenderingProviderDetail, RenderingProvidersList } from './pages/RenderingProviders';
import { theme } from './themes/ottehr';

const MUI_X_LICENSE_KEY = import.meta.env.VITE_APP_MUI_X_LICENSE_KEY;
if (MUI_X_LICENSE_KEY) LicenseInfo.setLicenseKey(MUI_X_LICENSE_KEY);

export default function App(): ReactElement {
  useApiClients();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
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
            <Route path="*" element={<Navigate to="/" />} />
          </Route>
        </Routes>
        <SnackbarProvider maxSnack={5} autoHideDuration={6000} />
      </BrowserRouter>
    </ThemeProvider>
  );
}
