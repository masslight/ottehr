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
  STRIPE_WEBHOOK_SECRET = 'STRIPE_WEBHOOK_SECRET',
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
  // Optional. Selects the easy-chart planner LLM backend as "<provider>:<model>"
  // (provider = vertex | anthropic). Unset → defaults to vertex:gemini-3.1-flash-lite.
  EASY_CHART_PLANNER_MODEL = 'EASY_CHART_PLANNER_MODEL',
  // Optional. The reliable BACKUP model (same "<provider>:<model>" form) the easy-chart calls escalate
  // to when the primary model fails (e.g. a flash-lite runaway hitting the output cap). Only runs on
  // those failures, so its higher per-token cost is bounded. Unset → defaults to anthropic:claude-sonnet-4-6.
  EASY_CHART_BACKUP_MODEL = 'EASY_CHART_BACKUP_MODEL',
  // Optional. Per-pass override for the easy-chart REVIEW zambda's LLM backend (same
  // "<provider>:<model>" form as EASY_CHART_PLANNER_MODEL), so the review model can be A/B-tested
  // independently of the planner. Unset → the review follows the planner-secret/default chain.
  EASY_CHART_REVIEW_MODEL = 'EASY_CHART_REVIEW_MODEL',
}
