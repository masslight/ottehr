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
      clientId="TODO"
      connection="sms"
      domain="https://zapehr-dev.us.auth0.com"
      redirectUri={window.location.origin}
    >
      <DataProvider>
        <App />
      </DataProvider>
    </Auth0Provider>
  </StrictMode>
);
