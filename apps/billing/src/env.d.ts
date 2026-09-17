/// <reference types="vite/client" />

// vite 8 ships an `exports`-map package with no top-level `types`/`main`, invisible to the app's
// classic "node" moduleResolution. Point the bare specifier at the real build output — the physical
// files exist, so classic resolution finds them.
declare module 'vite' {
  export * from 'vite/dist/node/index';
}

interface ImportMetaEnv {
  readonly VITE_APP_IS_LOCAL: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_ENV: string;
  readonly VITE_APP_OYSTEHR_APPLICATION_CLIENT_ID: string;
  readonly VITE_APP_OYSTEHR_APPLICATION_DOMAIN: string;
  readonly VITE_APP_OYSTEHR_APPLICATION_AUDIENCE: string;
  readonly VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL: string;
  readonly VITE_APP_OYSTEHR_APPLICATION_ID: string;
  readonly VITE_APP_FHIR_API_URL: string;
  readonly VITE_APP_PROJECT_API_URL: string;
  readonly VITE_APP_PROJECT_ID: string;
  readonly VITE_APP_PROJECT_API_ZAMBDA_URL: string;
  readonly VITE_APP_MUI_X_LICENSE_KEY: string;
  readonly VITE_APP_EHR_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
