import Oystehr, { User } from '@oystehr/sdk';
import { RelatedPerson } from 'fhir/r4b';
import { Secrets } from 'zambda-utils';
import { getAuth0Token } from './getAuth0Token';
import { createOystehrClient } from './helpers';

export async function getUser(token: string, secrets: Secrets | null): Promise<User> {
  const oystehr = createOystehrClient(token, secrets);
  const user = await oystehr.user.me();
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
