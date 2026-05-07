import { CssBaseline, ThemeProvider } from '@mui/material';
import { LicenseInfo } from '@mui/x-data-grid-pro';
import { SnackbarProvider } from 'notistack';
import { ReactElement } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useApiClients } from './hooks/useAppClients';
import ClaimDetail from './pages/ClaimDetail';
import ClaimsList from './pages/ClaimsList';
import Dashboard from './pages/Dashboard';
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
            <Route path="/claims/:id" element={<ClaimDetail />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Route>
        </Routes>
        <SnackbarProvider maxSnack={5} autoHideDuration={6000} />
      </BrowserRouter>
    </ThemeProvider>
  );
}
