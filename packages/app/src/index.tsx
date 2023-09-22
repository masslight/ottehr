import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import './lib/i18n';
import { Auth0Provider } from '@auth0/auth0-react';
import { IntakeDataProvider } from './store';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <Auth0Provider
      domain="https://zapehr-dev.us.auth0.com"
      clientId="zTvIC4lHOGvQUi0KWlvkUdotpQ2DRB5M"
      connection="sms"
      redirectUri={window.location.origin}
      audience="https://testing.api.zapehr.com"
    >
      <IntakeDataProvider>
        <App />
      </IntakeDataProvider>
    </Auth0Provider>
  </React.StrictMode>
);
