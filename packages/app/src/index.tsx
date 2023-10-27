import { Auth0Provider } from '@auth0/auth0-react';
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './lib/i18n';
import { DataProvider } from './store';

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <StrictMode>
    <Auth0Provider
      audience="https://api.zapehr.com"
      clientId="dRWFIqGw2L2G8tdM6GuBtNu9awsxRVV4"
      domain="https://zapehr-dev.us.auth0.com"
      redirectUri={`${window.location.origin}/dashboard`}
    >
      <DataProvider>
        <App />
      </DataProvider>
    </Auth0Provider>
  </StrictMode>
);
