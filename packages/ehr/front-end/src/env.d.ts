/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_IS_LOCAL: string;
  readonly VITE_APP_ZAPEHR_APPLICATION_CLIENT_ID: string;
  readonly VITE_APP_ZAPEHR_APPLICATION_DOMAIN: string;
  readonly VITE_APP_ZAPEHR_APPLICATION_AUDIENCE: string;
  readonly VITE_APP_ZAPEHR_APPLICATION_REDIRECT_URL: string;
  readonly VITE_APP_MUI_X_LICENSE_KEY: string;
  readonly VITE_APP_ORGANIZATION_NAME_LONG: string;
  readonly VITE_APP_ORGANIZATION_NAME_SHORT: string;
  readonly VITE_APP_ORGANIZATION_CONSENTS_DOMAIN: string;
  readonly VITE_APP_ZAPEHR_APPLICATION_ID: string;
  readonly VITE_APP_FHIR_API_URL: string;
  readonly VITE_APP_PROJECT_API_URL: string;
  readonly VITE_APP_PROJECT_API_ZAMBDA_URL: string;
  readonly VITE_APP_INTAKE_ZAMBDAS_URL: string;
  readonly VITE_APP_GET_APPOINTMENTS_ZAMBDA_ID: string;
  readonly VITE_APP_CREATE_APPOINTMENT_ZAMBDA_ID: string;
  readonly VITE_APP_UPDATE_USER_ZAMBDA_ID: string;
  readonly VITE_APP_DEACTIVATE_USER_ZAMBDA_ID: string;
  readonly VITE_APP_GET_TOKEN_FOR_CONVERSATION_ZAMBDA_ID: string;
  readonly VITE_APP_CHECK_IN_ZAMBDA_ID?: string;
  readonly VITE_APP_GET_PATIENT_ZAMBDA_ID?: string;
  readonly VITE_APP_GET_PATIENTS_ZAMBDA_ID?: string;
  readonly VITE_APP_GET_PAPERWORK_ZAMBDA_ID?: string;
  readonly VITE_APP_QRS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
