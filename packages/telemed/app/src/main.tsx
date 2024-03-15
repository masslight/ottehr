import { Auth0Provider } from '@auth0/auth0-react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import 'ottehr-components/lib/styles/main.css';
import App from './App';

if (!import.meta.env.VITE_APP_CLIENT_ID || !import.meta.env.VITE_APP_AUTH0_AUDIENCE) {
  throw new Error('Client ID or audience not found');
}
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Auth0Provider
      domain={import.meta.env.VITE_APP_AUTH_URL}
      clientId={import.meta.env.VITE_APP_CLIENT_ID}
      connection="sms"
      redirectUri={`${window.location.origin}`}
      audience={import.meta.env.VITE_APP_AUTH0_AUDIENCE}
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>,
);
