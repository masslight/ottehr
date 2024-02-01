import { Auth0Provider } from '@auth0/auth0-react';
// import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './lib/i18n';
import { DataProvider } from './store';

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
  // <StrictMode>
  <Auth0Provider
    audience={import.meta.env.VITE_APP_AUDIENCE}
    clientId={import.meta.env.VITE_APP_CLIENT_ID}
    domain={import.meta.env.VITE_APP_DOMAIN}
    redirectUri={import.meta.env.VITE_APP_REDIRECT_URL}
  >
    <DataProvider>
      <App />
    </DataProvider>
  </Auth0Provider>,
  // </StrictMode>
);
