import './index.css';
import { Auth0Provider } from '@auth0/auth0-react';
import { ErrorBoundary } from '@sentry/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

const CHUNK_RELOAD_AT_KEY = 'ottehr-chunk-reload-at';
const CHUNK_RELOAD_WINDOW_MS = 30_000;

/**
 * One reload per tab per window. A module-scope flag cannot do this: it is reset by the very
 * reload it is meant to bound, so a chunk that stays missing would reload forever. Falls through
 * to the error UI on the second failure instead. Returns true when reloading is allowed.
 */
const canReloadForChunkError = (): boolean => {
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_AT_KEY));
    if (last && Date.now() - last < CHUNK_RELOAD_WINDOW_MS) {
      return false;
    }
    sessionStorage.setItem(CHUNK_RELOAD_AT_KEY, String(Date.now()));
    return true;
  } catch {
    // Storage unavailable (Safari private mode). Keep the pre-existing behavior.
    return true;
  }
};

export const AUTH0_REDIRECT_URI =
  import.meta.env.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL_TELEMED &&
  location.href.includes(import.meta.env.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL_TELEMED)
    ? import.meta.env.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL_TELEMED
    : import.meta.env.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Auth0Provider
        domain={import.meta.env.VITE_APP_OYSTEHR_APPLICATION_DOMAIN || ''}
        clientId={import.meta.env.VITE_APP_OYSTEHR_APPLICATION_CLIENT_ID || ''}
        authorizationParams={{
          audience: import.meta.env.VITE_APP_OYSTEHR_APPLICATION_AUDIENCE,
          redirect_uri: AUTH0_REDIRECT_URI,
          connection: import.meta.env.VITE_APP_OYSTEHR_CONNECTION_NAME,
        }}
        cacheLocation="localstorage"
      >
        <ErrorBoundary
          onError={(error, errorInfo) => {
            console.log(String(error), errorInfo);
            // Handle chunk loading failures from deployments
            const errorString = String(error);
            if (
              errorString.includes('Failed to fetch dynamically imported module') ||
              errorString.includes('Importing a module script failed') ||
              errorString.includes('error loading dynamically imported module') ||
              // Safari/WebKit wording once a missing chunk is answered with 200 text/html by the
              // SPA fallback rather than a 404. Without this the reload never fires in Safari.
              errorString.includes('is not a valid JavaScript MIME type') ||
              errorString.includes('Failed to fetch')
            ) {
              if (canReloadForChunkError()) {
                console.log('Chunk loading error detected, reloading page...');
                location.reload();
              } else {
                console.log('Chunk loading error persisted across a reload, showing error UI.');
              }
            }
          }}
          fallback={<p>An error has occurred</p>}
        >
          <App />
        </ErrorBoundary>
      </Auth0Provider>
    </QueryClientProvider>
  </StrictMode>
);
