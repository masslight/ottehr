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
    audience="https://testing.api.zapehr.com"
    clientId="EyqrOvOx6BjkletcC9sF0vxQRGZcCZM4" // test
    domain="https://dev-auth.zapehr.com"
    redirectUri="http://localhost:5173/dashboard"
  >
    <DataProvider>
      <App />
    </DataProvider>
  </Auth0Provider>
  // </StrictMode>
);
