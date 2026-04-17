export interface Secrets {
  [secretName: string]: string;
}

export const getOptionalSecret = (secretKey: string, secrets: Secrets | null): string | undefined => {
  return secrets != null ? secrets[secretKey] : process.env[secretKey];
};

export const getSecret = (secretKey: string, secrets: Secrets | null): string => {
  const value = getOptionalSecret(secretKey, secrets);
  if (value == null) {
    throw new Error(`Secret or Environment Variable with key ${secretKey} was not set.`);
  }
  return value;
};

// use | to add more feature flags here as needed
export type BackendFeatureFlags = 'SKIP_SENDING_VISIT_NOTE_TO_PATIENT_PORTAL_WHEN_THE_NOTE_IS_SIGNED_FEATURE_FLAG';

/**
 * Check if a feature flag is enabled.
 * The backend and frontend feature flags have a single source of truth - zambda env files.
 * FeatureFlags accepts both the string "true" and the boolean true
 */
export const isFeatureFlagEnabled = (flagKey: BackendFeatureFlags, secrets: Secrets | null): boolean => {
  const positiveOptions = ['true', true];
  const flagValue = getOptionalSecret(flagKey, secrets) as string | boolean;
  return positiveOptions.includes(flagValue);
};

export enum SecretsKeys {
  WEBSITE_URL = 'WEBSITE_URL',
  AUTH0_ENDPOINT = 'AUTH0_ENDPOINT',
  AUTH0_AUDIENCE = 'AUTH0_AUDIENCE',
  AUTH0_CLIENT = 'AUTH0_CLIENT',
  AUTH0_SECRET = 'AUTH0_SECRET',
  DEFAULT_BILLING_RESOURCE = 'DEFAULT_BILLING_RESOURCE',
  FHIR_API = 'FHIR_API',
  PROJECT_API = 'PROJECT_API',
  ENVIRONMENT = 'ENVIRONMENT',
  SENDGRID_SEND_EMAIL_API_KEY = 'SENDGRID_SEND_EMAIL_API_KEY',
  SENDGRID_ERROR_REPORT_TEMPLATE_ID = 'SENDGRID_ERROR_REPORT_TEMPLATE_ID',
  ORGANIZATION_ID = 'ORGANIZATION_ID',
  IN_PERSON_PREBOOK_DISPLAY_TOMORROW_SLOTS_AT_HOUR = 'IN_PERSON_PREBOOK_DISPLAY_TOMORROW_SLOTS_AT_HOUR',
  INTAKE_ISSUE_REPORT_EMAIL_GROUP_ID = 'INTAKE_ISSUE_REPORT_EMAIL_GROUP_ID',
  PROJECT_ID = 'PROJECT_ID',
  SENTRY_AUTH_TOKEN = 'SENTRY_AUTH_TOKEN',
  SENTRY_ORG = 'SENTRY_ORG',
  SENTRY_PROJECT = 'SENTRY_PROJECT',
  SENTRY_DSN = 'SENTRY_DSN',
  CANDID_CLIENT_ID = 'CANDID_CLIENT_ID',
  CANDID_CLIENT_SECRET = 'CANDID_CLIENT_SECRET',
  CANDID_ENV = 'CANDID_ENV',
  STRIPE_PUBLIC_KEY = 'STRIPE_PUBLIC_KEY',
  STRIPE_SECRET_KEY = 'STRIPE_SECRET_KEY',
  STRIPE_PAYMENT_METHOD_TYPES = 'STRIPE_PAYMENT_METHOD_TYPES',
  ANTHROPIC_API_KEY = 'ANTHROPIC_API_KEY',
  GOOGLE_CLOUD_PROJECT_ID = 'GOOGLE_CLOUD_PROJECT_ID',
  GOOGLE_CLOUD_API_KEY = 'GOOGLE_CLOUD_API_KEY',
  ADVAPACS_CLIENT_ID = 'ADVAPACS_CLIENT_ID',
  ADVAPACS_CLIENT_SECRET = 'ADVAPACS_CLIENT_SECRET',
  ADVAPACS_WEBHOOK_SECRET = 'ADVAPACS_WEBHOOK_SECRET',
  ADVAPACS_VIEWER_USERNAME = 'ADVAPACS_VIEWER_USERNAME',
  GOOGLE_PLACES_API_KEY = 'GOOGLE_PLACES_API_KEY',
  PATIENT_LOGIN_REDIRECT_URL = 'PATIENT_LOGIN_REDIRECT_URL',
  POSTGRID_API_KEY = 'POSTGRID_API_KEY',
  POSTGRID_ENV = 'POSTGRID_ENV',
}
