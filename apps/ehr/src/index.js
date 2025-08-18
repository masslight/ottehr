"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTH0_REDIRECT_URI = void 0;
require("./index.css");
var auth0_react_1 = require("@auth0/auth0-react");
var react_1 = require("@sentry/react");
var react_2 = require("react");
var client_1 = require("react-dom/client");
var react_query_1 = require("react-query");
var App_1 = require("./App");
var root = client_1.default.createRoot(document.getElementById('root'));
exports.AUTH0_REDIRECT_URI = import.meta.env.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL_TELEMED &&
    location.href.includes(import.meta.env.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL_TELEMED)
    ? import.meta.env.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL_TELEMED
    : import.meta.env.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL;
var queryClient = new react_query_1.QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
        },
    },
});
root.render(<react_2.StrictMode>
    <react_query_1.QueryClientProvider client={queryClient}>
      <auth0_react_1.Auth0Provider domain={import.meta.env.VITE_APP_OYSTEHR_APPLICATION_DOMAIN || ''} clientId={import.meta.env.VITE_APP_OYSTEHR_APPLICATION_CLIENT_ID || ''} authorizationParams={{
        audience: import.meta.env.VITE_APP_OYSTEHR_APPLICATION_AUDIENCE,
        redirect_uri: exports.AUTH0_REDIRECT_URI,
        connection: import.meta.env.VITE_APP_OYSTEHR_CONNECTION_NAME,
    }} cacheLocation="localstorage">
        <react_1.ErrorBoundary fallback={<p>An error has occurred</p>}>
          <App_1.default />
        </react_1.ErrorBoundary>
      </auth0_react_1.Auth0Provider>
    </react_query_1.QueryClientProvider>
  </react_2.StrictMode>);
//# sourceMappingURL=index.js.map