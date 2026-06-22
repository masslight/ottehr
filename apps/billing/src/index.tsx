import './index.css';
import { Auth0Provider } from '@auth0/auth0-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

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
          redirect_uri: import.meta.env.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL,
          connection: import.meta.env.VITE_APP_OYSTEHR_CONNECTION_NAME,
        }}
        cacheLocation="localstorage"
      >
        <App />
      </Auth0Provider>
    </QueryClientProvider>
  </StrictMode>
);
