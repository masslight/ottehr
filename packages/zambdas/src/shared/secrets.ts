import { Secrets } from '../types';

// Throws if secret could not be found
export const getSecret = (secretKey: string, secrets: Secrets | null): string => {
  let value: string | undefined;

  if (secrets != null && Object.keys(secrets).length > 0) {
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
  AUTH0_AUDIENCE = 'AUTH0_AUDIENCE',
  AUTH0_CLIENT = 'AUTH0_CLIENT',
  AUTH0_ENDPOINT = 'AUTH0_ENDPOINT',
  AUTH0_SECRET = 'AUTH0_SECRET',
  ENVIRONMENT = 'ENVIRONMENT',
  FHIR_API = 'FHIR_API',
  M2M_SECRET = 'M2M_SECRET',
  PROJECT_API = 'PROJECT_API',
  PROJECT_ID = 'PROJECT_ID',
}
