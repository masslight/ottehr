import { Secrets } from '../types';

// Throws if secret could not be found
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
  AUTH0_AUDIENCE = 'AUTH0_AUDIENCE',
  FHIR_API = 'FHIR_API',
  PROJECT_API = 'PROJECT_API',
  ENVIRONMENT = 'ENVIRONMENT',
  SLACK_CHANNEL_HOOK_URL = 'SLACK_CHANNEL_HOOK_URL',
  SENDGRID_API_KEY = 'SENDGRID_API_KEY',
  SENDGRID_EMAIL = 'SENDGRID_EMAIL',
  SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID = 'SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID',
  SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID = 'SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID',
  SENDGRID_ERROR_EMAIL_TEMPLATE_ID = 'SENDGRID_ERROR_EMAIL_TEMPLATE_ID',
  VISIT_TYPE = 'VISIT_TYPE',
}
