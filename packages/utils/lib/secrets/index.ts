export interface Secrets {
  [secretName: string]: string;
}

export const getSecret = (secretKey: string, secrets: Secrets | null): string => {
  let value: string | undefined;
  if (secrets != null) {
    value = secrets[secretKey];
  } else {
    value = process.env[secretKey];
  }

  if (value == null) {
    throw new Error(`Secret or Environment Variable with key ${secretKey} was not set.`);
  }

  return value;
};

export enum SecretsKeys {
  AUTH0_ENDPOINT = 'AUTH0_ENDPOINT',
  AUTH0_CLIENT = 'AUTH0_CLIENT',
  AUTH0_SECRET = 'AUTH0_SECRET',
  MESSAGING_DEVICE_ID = 'MESSAGING_DEVICE_ID',
  MESSAGING_M2M_CLIENT = 'MESSAGING_M2M_CLIENT',
  MESSAGING_M2M_SECRET = 'MESSAGING_M2M_SECRET',
  SENDGRID_API_KEY = 'SENDGRID_API_KEY',
  SENDGRID_EMAIL = 'SENDGRID_EMAIL',
  SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID = 'SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID',
  SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID = 'SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID',
  SENDGRID_ERROR_EMAIL_TEMPLATE_ID = 'SENDGRID_ERROR_EMAIL_TEMPLATE_ID',
  SLACK_CHANNEL_HOOK_URL = 'SLACK_CHANNEL_HOOK_URL',
  AUTH0_AUDIENCE = 'AUTH0_AUDIENCE',
  FHIR_API = 'FHIR_API',
  PROJECT_API = 'PROJECT_API',
  PROJECT_ID = 'PROJECT_ID',
  ENVIRONMENT = 'ENVIRONMENT',
  ORGANIZATION_ID = 'ORGANIZATION_ID',
  WEBSITE_URL = 'WEBSITE_URL',
}
