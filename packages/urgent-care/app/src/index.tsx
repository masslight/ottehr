import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import './lib/i18n';
import { Auth0Provider } from '@auth0/auth0-react';
import { IntakeDataProvider } from './store';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
if (!import.meta.env.VITE_APP_APPLICATION_CLIENT_ID || !import.meta.env.VITE_APP_AUTH0_AUDIENCE) {
  throw new Error('Client ID or audience not found');
}
root.render(
  <React.StrictMode>
    <Auth0Provider
      domain={import.meta.env.VITE_APP_AUTH_URL}
      clientId={import.meta.env.VITE_APP_APPLICATION_CLIENT_ID}
      connection="sms"
      redirectUri={`${window.location.origin}/patients`}
      audience={import.meta.env.VITE_APP_AUTH0_AUDIENCE}
    >
      <IntakeDataProvider>
        <App />
      </IntakeDataProvider>
    </Auth0Provider>
  </React.StrictMode>,
);
