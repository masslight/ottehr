/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_IS_LOCAL: string;
  readonly VITE_APP_APPLICATION_CLIENT_ID: string;
  readonly VITE_APP_AUTH0_AUDIENCE: string;
  readonly VITE_APP_FHIR_API_URL: string;
  readonly VITE_APP_PROJECT_API_URL: string;
  readonly VITE_APP_UPLOAD_URL?: string;
  readonly VITE_APP_CHECK_IN_ZAMBDA_ID: string;
  readonly VITE_APP_CREATE_APPOINTMENT_ZAMBDA_ID: string;
  readonly VITE_APP_CANCEL_APPOINTMENT_ZAMBDA_ID: string;
  readonly VITE_APP_GET_PATIENTS_ZAMBDA_ID: string;
  readonly VITE_APP_UPDATE_APPOINTMENT_ZAMBDA_ID: string;
  readonly VITE_APP_GET_LOCATION_ZAMBDA_ID: string;
  readonly VITE_APP_GET_APPOINTMENTS_ZAMBDA_ID: string;
  readonly VITE_APP_GET_PAPERWORK_ZAMBDA_ID: string;
  readonly VITE_APP_UPDATE_PAPERWORK_ZAMBDA_ID: string;
  readonly VITE_APP_GET_PRESIGNED_FILE_URL_ZAMBDA_ID: string;
  readonly VITE_APP_MIXPANEL_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
