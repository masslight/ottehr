import { User } from '@oystehr/sdk';
import { decodeJwt } from 'jose';
import { createOystehrClient } from '../helpers';
import { getSecret, Secrets, SecretsKeys } from '../secrets';

export const TEST_USER_ID = 'test-M2M-user-id';

/**
 * When token is for a User, this function calls oystehr.user.me() with that token
 * When token is for an M2M Client, this function
 * calls oystehr.m2m.me() with that token and then returns a User object so that the m2m
 * can pretend to be a User for integration testing purposes. */
export const userMe = async (token: string, secrets: Secrets | null): Promise<User> => {
  const fhirAPI = getSecret(SecretsKeys.FHIR_API, secrets);
  const projectAPI = getSecret(SecretsKeys.PROJECT_API, secrets);
  const oystehr = createOystehrClient(token, fhirAPI, projectAPI);
  const decodedToken = decodeJwt(token);
  if (decodedToken.sub?.includes('@client') && getSecret(SecretsKeys.ENVIRONMENT, secrets) === 'local') {
    const m2mClient = await oystehr.m2m.me();
    const isMockProvider = m2mClient.description === M2MClientMockType.provider;
    return {
      id: TEST_USER_ID,
      name: isMockProvider ? 'm2mClientTest@ottehr.com' : '+11231231234',
      phoneNumber: isMockProvider ? null : '+11231231234', // patient mock has phone number, provider mock does not
      authenticationMethod: isMockProvider ? 'email' : 'sms', // patient mock uses sms, provider mock uses email
      email: isMockProvider ? 'm2mClientTest@ottehr.com' : null, // provider mock has email, patient mock does not
      profile: m2mClient.profile,
      roles: m2mClient.roles,
    };
  } else {
    return await oystehr.user.me();
  }
};

export enum M2MClientMockType {
  provider = 'mock-provider',
  patient = 'mock-patient',
}
