import Oystehr, { User } from '@oystehr/sdk';
import { RelatedPerson } from 'fhir/r4b';
import { Secrets, SecretsKeys, getAuth0Token } from 'utils';
import { createOystehrClient } from './helpers';

export async function getUser(token: string, secrets: Secrets | null): Promise<User> {
  const oystehr = createOystehrClient(token, secrets);
  const user = await oystehr.user.me(); // todo: check
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

export async function getAccessToken(secrets: Secrets | null): Promise<string> {
  const clientIdKey = SecretsKeys.AUTH0_CLIENT;
  const secretIdKey = SecretsKeys.AUTH0_SECRET;

  return getAuth0Token({ secretIdKey, clientIdKey, secrets });
}

export async function getM2MClientToken(secrets: Secrets | null): Promise<string> {
  const clientIdKey = SecretsKeys.AUTH0_CLIENT;
  const secretIdKey = SecretsKeys.AUTH0_SECRET;

  return getAuth0Token({
    clientIdKey,
    secretIdKey,
    secrets,
  });
}

export async function checkOrCreateM2MClientToken(token: string, secrets: Secrets | null): Promise<string> {
  if (!token) {
    console.log('getting token');
    return await getM2MClientToken(secrets);
  } else {
    console.log('already have token');
    return token;
  }
}
