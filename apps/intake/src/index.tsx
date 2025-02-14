import { Auth0Provider } from '@auth0/auth0-react';
import hasOwn from 'object.hasown';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './lib/i18n';

window.global ||= window; // https://stackoverflow.com/questions/72795666/how-to-fix-vite-build-parser-error-unexpected-token-in-third-party-dependenc

// polyfill for fixing missing hasOwn Object property in some browsers
// https://www.npmjs.com/package/object.hasown
if (!Object.hasOwn) {
  hasOwn.shim();
}

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
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>
);
