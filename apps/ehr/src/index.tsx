import { Auth0Provider } from '@auth0/auth0-react';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from 'react-query';
import App from './App';
import './index.css';

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
        <App />
      </Auth0Provider>
    </QueryClientProvider>
  </StrictMode>
);
