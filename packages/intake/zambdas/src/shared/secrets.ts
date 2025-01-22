import { Secrets } from 'utils';

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
  AUTH0_AUDIENCE = 'AUTH0_AUDIENCE',
  FHIR_API = 'FHIR_API',
  PROJECT_API = 'PROJECT_API',
  ENVIRONMENT = 'ENVIRONMENT',
  SENDGRID_API_KEY = 'SENDGRID_API_KEY',
  SENDGRID_EMAIL_BCC = 'SENDGRID_EMAIL_BCC',
  IN_PERSON_SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID = 'IN_PERSON_SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID',
  IN_PERSON_SENDGRID_SPANISH_CONFIRMATION_EMAIL_TEMPLATE_ID = 'IN_PERSON_SENDGRID_SPANISH_CONFIRMATION_EMAIL_TEMPLATE_ID',
  IN_PERSON_SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID = 'IN_PERSON_SENDGRID_CANCELLATION_EMAIL_TEMPLATE_ID',
  IN_PERSON_SENDGRID_SPANISH_CANCELLATION_EMAIL_TEMPLATE_ID = 'IN_PERSON_SENDGRID_SPANISH_CANCELLATION_EMAIL_TEMPLATE_ID',
  IN_PERSON_SENDGRID_ERROR_EMAIL_TEMPLATE_ID = 'IN_PERSON_SENDGRID_ERROR_EMAIL_TEMPLATE_ID',
  ORGANIZATION_ID = 'ORGANIZATION_ID',
  WEBSITE_URL = 'WEBSITE_URL',
}
