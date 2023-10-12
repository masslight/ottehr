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
  OTTEHR_AUTH0_CLIENT = 'OTTEHR_AUTH0_CLIENT',
  OTTEHR_AUTH0_SECRET = 'OTTEHR_AUTH0_SECRET',
  OTTEHR_SENDGRID_ERROR_EMAIL_TEMPLATE_ID = 'OTTEHR_SENDGRID_ERROR_EMAIL_TEMPLATE_ID',
  AUTH0_AUDIENCE = 'AUTH0_AUDIENCE',
  FHIR_API = 'FHIR_API',
  ENVIRONMENT = 'ENVIRONMENT',
  SENDGRID_API_KEY = 'SENDGRID_API_KEY',
}
