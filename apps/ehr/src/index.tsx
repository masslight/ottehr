import './index.css';
import { Auth0Provider } from '@auth0/auth0-react';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ErrorBoundary } from '@sentry/react';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from 'react-query';
import { initializeAppConfig } from '../../config/initConfig';
import App from './App';

// ⏳ Load config BEFORE anything else (Top-level await)
initializeAppConfig();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

export const AUTH0_REDIRECT_URI =
  import.meta.env.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL_TELEMED &&
  location.href.includes(import.meta.env.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL_TELEMED)
    ? import.meta.env.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL_TELEMED
    : import.meta.env.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Auth0Provider
        domain={import.meta.env.VITE_APP_OYSTEHR_APPLICATION_DOMAIN || ''}
        clientId={import.meta.env.VITE_APP_OYSTEHR_APPLICATION_CLIENT_ID || ''}
        authorizationParams={{
          audience: import.meta.env.VITE_APP_OYSTEHR_APPLICATION_AUDIENCE,
          redirect_uri: AUTH0_REDIRECT_URI,
          connection: import.meta.env.VITE_APP_OYSTEHR_CONNECTION_NAME,
        }}
        cacheLocation="localstorage"
      >
        <ErrorBoundary fallback={<p>An error has occurred</p>}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <App />
          </LocalizationProvider>
        </ErrorBoundary>
      </Auth0Provider>
    </QueryClientProvider>
  </StrictMode>
);
