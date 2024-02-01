import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import { IntakeDataProvider } from './store/IntakeContext';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <StrictMode>
    <Auth0Provider
      domain={import.meta.env.VITE_APP_ZAPEHR_APPLICATION_DOMAIN || ''}
      clientId={import.meta.env.VITE_APP_ZAPEHR_APPLICATION_CLIENT_ID || ''}
      audience={import.meta.env.VITE_APP_ZAPEHR_APPLICATION_AUDIENCE}
      redirectUri={import.meta.env.VITE_APP_ZAPEHR_APPLICATION_REDIRECT_URL}
      connection={import.meta.env.VITE_APP_ZAPEHR_CONNECTION_NAME}
    >
      <IntakeDataProvider>
        <App />
      </IntakeDataProvider>
    </Auth0Provider>
  </StrictMode>,
);
