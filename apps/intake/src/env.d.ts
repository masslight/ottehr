/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_IS_LOCAL: string;
  readonly VITE_APP_CLIENT_ID: string;
  readonly VITE_APP_AUTH0_AUDIENCE: string;
  readonly VITE_APP_FHIR_API_URL: string;
  readonly VITE_APP_PROJECT_API_URL: string;
  readonly VITE_APP_UPLOAD_URL?: string;
  readonly VITE_APP_MIXPANEL_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
