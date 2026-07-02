declare module 'vitest' {
  export interface ProvidedContext {
    EXECUTE_ZAMBDA_URL: string;
    ADMIN_TOKEN: string;
    M2M_PROVIDER_TOKEN: string;
    M2M_PROVIDER_PROFILE: string;
    M2M_PATIENT_TOKEN: string;
    M2M_PATIENT_PROFILE: string;
    INTEGRATION_TEST_RUN_ID: string;
  }
}

// mark this file as a module so augmentation works correctly
export {};
