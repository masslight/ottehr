import { Auth0Provider } from '@auth0/auth0-react';
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './lib/i18n';
import { IntakeDataProvider } from './store';

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <StrictMode>
    <Auth0Provider
      domain="https://zapehr-dev.us.auth0.com"
      clientId="TODO"
      connection="sms"
      redirectUri={window.location.origin}
      audience="https://api.zapehr.com"
    >
      <IntakeDataProvider>
        <App />
      </IntakeDataProvider>
    </Auth0Provider>
  </StrictMode>
);
