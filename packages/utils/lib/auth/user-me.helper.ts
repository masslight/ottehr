import { User } from '@oystehr/sdk';
import { decodeJwt } from 'jose';
import { createOystehrClient } from '../helpers';
import { getSecret, Secrets, SecretsKeys } from '../secrets';

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
  if (decodedToken.sub?.includes('@client')) {
    // TODO helper function for this.
    const m2mClient = await oystehr.m2m.me();
    return {
      id: m2mClient.id,
      name: 'm2m client',
      phoneNumber: '+11231231234',
      authenticationMethod: 'email',
      email: 'm2mClientTest@ottehr.com',
      profile: m2mClient.profile,
      roles: m2mClient.roles,
    };
  } else {
    return await oystehr.user.me();
  }
};
