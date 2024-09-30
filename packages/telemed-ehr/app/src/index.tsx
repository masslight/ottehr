import { Auth0Provider } from '@auth0/auth0-react';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from 'react-query';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

export const AUTH0_REDIRECT_URI =
  import.meta.env.VITE_APP_ZAPEHR_APPLICATION_REDIRECT_URL_TELEMED &&
  location.href.includes(import.meta.env.VITE_APP_ZAPEHR_APPLICATION_REDIRECT_URL_TELEMED)
    ? import.meta.env.VITE_APP_ZAPEHR_APPLICATION_REDIRECT_URL_TELEMED
    : import.meta.env.VITE_APP_ZAPEHR_APPLICATION_REDIRECT_URL;

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
        domain={import.meta.env.VITE_APP_ZAPEHR_APPLICATION_DOMAIN || ''}
        clientId={import.meta.env.VITE_APP_ZAPEHR_APPLICATION_CLIENT_ID || ''}
        audience={import.meta.env.VITE_APP_ZAPEHR_APPLICATION_AUDIENCE}
        redirectUri={AUTH0_REDIRECT_URI}
        connection={import.meta.env.VITE_APP_ZAPEHR_CONNECTION_NAME}
      >
        <App />
      </Auth0Provider>
    </QueryClientProvider>
  </StrictMode>,
);
