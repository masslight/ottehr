import './index.css';
import './lib/i18n';
import { Auth0Provider } from '@auth0/auth0-react';
import hasOwn from 'object.hasown';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { initializeAppConfig } from '../../config/initConfig';
import App from './App';

// polyfill for fixing missing hasOwn Object property in some browsers
// https://www.npmjs.com/package/object.hasown
if (!Object.hasOwn) {
  hasOwn.shim();
}

initializeAppConfig();

window.global ||= window;

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
const { VITE_APP_AUTH0_AUDIENCE, VITE_APP_AUTH_URL, VITE_APP_CLIENT_ID } = import.meta.env;
if (!VITE_APP_CLIENT_ID || !VITE_APP_AUTH0_AUDIENCE) {
  throw new Error('Client ID or audience not found');
}
root.render(
  <React.StrictMode>
    <Auth0Provider
      domain={VITE_APP_AUTH_URL}
      clientId={VITE_APP_CLIENT_ID}
      authorizationParams={{
        connection: 'sms',
        redirectUri: `${window.location.origin}/redirect`,
        audience: VITE_APP_AUTH0_AUDIENCE,
        scope: 'openid profile email offline_access',
      }}
      useRefreshTokens={true}
      useRefreshTokensFallback={true}
      // adding cache location so that auth persists on page refresh
      // https://stackoverflow.com/questions/63537913/auth0-does-not-persist-login-on-page-refresh-for-email-password
      cacheLocation="localstorage"
      onRedirectCallback={(appState) => {
        // If the appState is not defined, we can just return
        if (!appState || !appState.target) {
          return;
        }
        // Otherwise, we can stick appState.target in local storage so that it can be used in the auth landing page
        localStorage.setItem('redirectDestination', appState.target);
      }}
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>
);
