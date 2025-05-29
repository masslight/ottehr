import Oystehr, { User } from '@oystehr/sdk';
import { RelatedPerson } from 'fhir/r4b';
import { getAuth0Token } from './getAuth0Token';
import { createOystehrClient } from './helpers';
import { getSecret, Secrets, SecretsKeys } from 'utils';
import { decodeJwt } from 'jose';

const TEST_USER_ID = 'test-M2M-user-id';
export async function getUser(token: string, secrets: Secrets | null, testProfile?: string): Promise<User> {
  const oystehr = createOystehrClient(token, secrets);

  let user: User;
  try {
    user = await oystehr.user.me();
  } catch (error: any) {
    const isTestClient = token && isTestM2MClient(token, secrets);
    console.log('isTestClient', isTestClient);
    if (!isTestClient) {
      throw error;
    }
    user = {
      id: 'test-M2M-user-id',
      email: 'test-M2M-user-email',
      name: '+15555555555',
      phoneNumber: '+15555555555',
      profile: testProfile || 'test-M2M-user-profile',
      authenticationMethod: 'sms',
    };
  }

  return user;
}

export async function getPersonForPatient(patientID: string, oystehr: Oystehr): Promise<RelatedPerson | undefined> {
  const resources = (
    await oystehr.fhir.search<RelatedPerson>({
      resourceType: 'Patient',
      params: [
        {
          name: 'id',
          value: `Patient/${patientID}`,
        },
        {
          name: '_include',
          value: 'Patient:RelatedPerson',
        },
        {
          name: '_include',
          value: 'Person:RelatedPerson',
        },
      ],
    })
  ).unbundle();

  if (resources.length !== 0) {
    return undefined;
  }
  return resources[0] as RelatedPerson;
}

export type AuthType = 'regular';

export async function checkOrCreateM2MClientToken(token: string, secrets: Secrets | null): Promise<string> {
  if (!token) {
    console.log('getting token');
    return await getAuth0Token(secrets);
  } else {
    console.log('already have token');
    return token;
  }
}

export const isTestM2MClient = (token: string, secrets: Secrets | null): boolean => {
  const decoded = decodeJwt(token);

  if (!decoded) {
    return false;
  }

  const testM2MClientId = getSecret(SecretsKeys.AUTH0_CLIENT, secrets);
  return testM2MClientId === (decoded as any).sub?.split('@')?.[0];
};

export const isTestUser = (user: User): boolean => {
  return user.id === TEST_USER_ID;
};

export const checkIsEHRUser = (user: User): boolean => {
  return !user?.name?.startsWith?.('+') && !isTestUser(user);
};
