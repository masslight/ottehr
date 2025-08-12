/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_IS_LOCAL: 'true' | 'false';
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_OYSTEHR_APPLICATION_CLIENT_ID: string;
  readonly VITE_APP_OYSTEHR_APPLICATION_DOMAIN: string;
  readonly VITE_APP_OYSTEHR_APPLICATION_AUDIENCE: string;
  readonly VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL: string;
  readonly VITE_APP_MUI_X_LICENSE_KEY: string;
  readonly VITE_APP_OYSTEHR_APPLICATION_ID: string;
  readonly VITE_APP_FHIR_API_URL: string;
  readonly VITE_APP_PROJECT_API_URL: string;
  readonly VITE_APP_PROJECT_ID: string;
  readonly VITE_APP_PROJECT_API_ZAMBDA_URL: string;
  readonly VITE_APP_PATIENT_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
