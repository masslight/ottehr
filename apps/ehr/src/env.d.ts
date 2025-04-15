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
  readonly VITE_APP_PROJECT_API_ZAMBDA_URL_OLD: string;
  readonly VITE_APP_PROJECT_API_ZAMBDA_URL: string;
  readonly VITE_APP_GET_APPOINTMENTS_ZAMBDA_ID: string;
  readonly VITE_APP_CREATE_APPOINTMENT_ZAMBDA_ID: string;
  readonly VITE_APP_UPDATE_USER_ZAMBDA_ID: string;
  readonly VITE_APP_DEACTIVATE_USER_ZAMBDA_ID: string;
  readonly VITE_APP_CHECK_IN_ZAMBDA_ID?: string;
  readonly VITE_APP_GET_TELEMED_APPOINTMENTS_ZAMBDA_ID?: string;
  readonly VITE_APP_GET_USER_ZAMBDA_ID?: string;
  readonly VITE_APP_INIT_TELEMED_SESSION_ZAMBDA_ID?: string;
  readonly VITE_APP_GET_CHART_DATA_ZAMBDA_ID?: string;
  readonly VITE_APP_SAVE_CHART_DATA_ZAMBDA_ID?: string;
  readonly VITE_APP_DELETE_CHART_DATA_ZAMBDA_ID?: string;
  readonly VITE_APP_CHANGE_TELEMED_APPOINTMENT_STATUS_ZAMBDA_ID?: string;
  readonly VITE_APP_CHANGE_IN_PERSON_VISIT_STATUS_ZAMBDA_ID?: string;
  readonly VITE_APP_ASSIGN_PRACTITIONER_ZAMBDA_ID: string;
  readonly VITE_APP_UNASSIGN_PRACTITIONER_ZAMBDA_ID: string;
  readonly VITE_APP_QRS_URL?: string;
  readonly VITE_APP_GET_PATIENT_INSTRUCTIONS_ZAMBDA_ID?: string;
  readonly VITE_APP_SAVE_PATIENT_INSTRUCTION_ZAMBDA_ID?: string;
  readonly VITE_APP_SAVE_PATIENT_FOLLOWUP_ZAMBDA_ID?: string;
  readonly VITE_APP_DELETE_PATIENT_INSTRUCTION_ZAMBDA_ID?: string;
  readonly VITE_APP_ICD_SEARCH_ZAMBDA_ID?: string;
  readonly VITE_APP_GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID?: string;
  readonly VITE_APP_CREATE_PATIENT_UPLOAD_DOCUMENT_URL_ZAMBDA_ID?: string;
  readonly VITE_APP_CREATE_UPDATE_MEDICATION_ORDER_ZAMBDA_ID?: string;
  readonly VITE_APP_GET_MEDICATION_ORDERS_ZAMBDA_ID?: string;
  readonly VITE_APP_CREATE_LAB_ORDER_ZAMBDA_ID?: string;
  readonly VITE_APP_GET_CREATE_LAB_ORDER_RESOURCES?: string;
  readonly VITE_APP_GET_LAB_ORDERS_ZAMBDA_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
