import Oystehr, { User } from '@oystehr/sdk';
import { Patient, RelatedPerson } from 'fhir/r4b';
import { decodeJwt } from 'jose';
import { getPatientsForUser, getSecret, Secrets, SecretsKeys } from 'utils';
import { getAuth0Token } from './getAuth0Token';
import { createOystehrClient } from './helpers';

const TEST_USER_ID = 'test-M2M-user-id';
export async function getUser(token: string, secrets: Secrets | null, testProfile?: string): Promise<User> {
  const oystehr = createOystehrClient(token, secrets);

  const ENV = getSecret(SecretsKeys.ENVIRONMENT, secrets);

  let user: User;
  try {
    user = await oystehr.user.me();
  } catch (error: any) {
    const isTestClient = token && isTestM2MClient(token, secrets) && ENV === 'local';
    console.log('isTestClient', isTestClient);
    if (!isTestClient) {
      throw error;
    }
    user = {
      id: 'test-M2M-user-id',
      email: 'test-M2M-user-email',
      name: '+12025555555',
      phoneNumber: '+12025555555',
      profile: testProfile || 'test-M2M-user-profile',
      authenticationMethod: 'sms',
    };
  }

  return user;
}

export async function getPersonForPatient(patientID: string, oystehr: Oystehr): Promise<RelatedPerson | undefined> {
  const resources = (
    await oystehr.fhir.search<Patient | RelatedPerson>({
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

export async function userHasAccessToPatient(user: User, patientID: string, oystehr: Oystehr): Promise<boolean> {
  // todo: change this to use check user is ehr user utility once branch defining it is merged
  const isEHRUser = checkIsEHRUser(user);
  if (isEHRUser) {
    // for now, if the user is an EHR user, they have access to all patients by default
    return true;
  }
  // Get all of the patients the user has access to,
  // get the ID for each patient,
  // check any of those patients match the patientID parameter,
  // if so return true otherwise return false
  return (await getPatientsForUser(user, oystehr)).some((patientTemp) => patientTemp.id === patientID);
}
