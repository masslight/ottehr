import { FhirClient, User } from '@zapehr/sdk';
import { Patient, Person, RelatedPerson, Resource } from 'fhir/r4';
import { createAppClient } from './helpers';
import { PRIVATE_EXTENSION_BASE_URL, Secrets, SecretsKeys, getAuth0Token } from 'utils';

// Return true if a new user
export async function createUserResourcesForPatient(
  fhirClient: FhirClient,
  patientID: string,
  phoneNumber: string,
): Promise<{ relatedPerson: RelatedPerson; person: Person; newUser: boolean }> {
  console.log(`Creating a RelatedPerson for Patient ${patientID}`);
  const relatedPerson = (await fhirClient.createResource({
    resourceType: 'RelatedPerson',
    relationship: [
      {
        coding: [
          {
            system: `${PRIVATE_EXTENSION_BASE_URL}/relationship`,
            code: 'user-relatedperson',
          },
        ],
      },
    ],
    telecom: [{ system: 'phone', value: phoneNumber }],
    patient: {
      reference: `Patient/${patientID}`,
    },
  })) as RelatedPerson;

  console.log(`For Patient ${patientID} created a RelatedPerson ${relatedPerson.id}`);
  console.log(`Searching for Person with phone number ${phoneNumber}`);

  const personResults: Person[] = await fhirClient.searchResources({
    resourceType: 'Person',
    searchParams: [
      {
        name: 'telecom',
        value: phoneNumber,
      },
    ],
  });

  let person: Person | undefined = undefined;
  let newUser = false;

  if (personResults.length === 0) {
    newUser = true;
    console.log(`Did not find a Person for user with phone number ${phoneNumber}, creating one`);
    person = (await fhirClient.createResource({
      resourceType: 'Person',
      telecom: [{ system: 'phone', value: phoneNumber }],
      link: [
        {
          target: { reference: `RelatedPerson/${relatedPerson.id}` },
        },
      ],
    })) as Person;
    console.log(`For user with phone number ${phoneNumber} created a Person ${person.id}`);
  } else {
    console.log(
      `Did find a Person with phone number ${phoneNumber} with ID ${personResults[0].id}, adding RelatedPerson ${relatedPerson.id} to link`,
    );
    person = personResults[0];
    await fhirClient.patchResource({
      resourceType: 'Person',
      resourceId: person.id || '',
      operations: [
        {
          op: 'add',
          path: '/link/0',
          value: {
            target: {
              reference: `RelatedPerson/${relatedPerson.id}`,
            },
          },
        },
      ],
    });
    console.log(`Updated Person with ID ${person.id}`);
  }

  return { relatedPerson, person, newUser };
}

export async function getUser(token: string, secrets: Secrets | null): Promise<User> {
  const appClient = createAppClient(token, secrets);
  const user = await appClient.getMe();
  return user;
}

export async function getPatientsForUser(user: User, fhirClient: FhirClient): Promise<Patient[]> {
  const resources: Resource[] = await fhirClient.searchResources({
    resourceType: 'Person',
    searchParams: [
      {
        name: 'telecom',
        // user.name is user phone number
        value: user.name,
      },
      {
        name: '_include',
        value: 'Person:relatedperson',
      },
      {
        name: '_include:iterate',
        value: 'RelatedPerson:patient',
      },
    ],
  });
  const resourcesTemp = resources.filter((resourceTemp) => resourceTemp.resourceType === 'Patient');
  return resourcesTemp as Patient[];
}

export async function userHasAccessToPatient(user: User, patientID: string, fhirClient: FhirClient): Promise<boolean> {
  // Get all of the patients the user has access to,
  // get the ID for each patient,
  // check any of those patients match the patientID parameter,
  // if so return true otherwise return false
  return (await getPatientsForUser(user, fhirClient)).map((patientTemp) => patientTemp.id).includes(patientID);
}

export async function getRelatedPersonForPatient(
  patientID: string,
  fhirClient: FhirClient,
): Promise<RelatedPerson | undefined> {
  console.log(`getting user-relatedperson for patient with id ${patientID}`);
  const resources: Resource[] = await fhirClient.searchResources({
    resourceType: 'RelatedPerson',
    searchParams: [
      {
        name: 'patient',
        value: `Patient/${patientID}`,
      },
      {
        name: 'relationship',
        value: 'user-relatedperson',
      },
    ],
  });

  if (resources.length !== 1) {
    return undefined;
  }
  return resources[0] as RelatedPerson;
}

export async function getPersonForPatient(
  patientID: string,
  fhirClient: FhirClient,
): Promise<RelatedPerson | undefined> {
  const resources: Resource[] = await fhirClient.searchResources({
    resourceType: 'Patient',
    searchParams: [
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
  });

  if (resources.length !== 0) {
    return undefined;
  }
  return resources[0] as RelatedPerson;
}

export async function getRelatedPersonsForPhoneNumber(
  phoneNumber: string,
  fhirClient: FhirClient,
): Promise<RelatedPerson[] | undefined> {
  const resources: Resource[] = await fhirClient.searchResources({
    resourceType: 'Person',
    searchParams: [
      {
        name: 'telecom',
        // user.name is user phone number
        value: phoneNumber,
      },
      {
        name: '_include',
        value: 'Person:relatedperson',
      },
      // {
      //   name: '_include:iterate',
      //   value: 'RelatedPerson:patient',
      // },
    ],
  });
  const resourcesTemp = resources.filter((resourceTemp) => resourceTemp.resourceType === 'RelatedPerson');
  return resourcesTemp as RelatedPerson[];
}

export type AuthType = 'regular' | 'messaging';

export async function getAccessToken(secrets: Secrets | null, type: AuthType = 'regular'): Promise<string> {
  let clientIdKey: SecretsKeys.AUTH0_CLIENT | SecretsKeys.MESSAGING_M2M_CLIENT;
  let secretIdKey: SecretsKeys.AUTH0_SECRET | SecretsKeys.MESSAGING_M2M_SECRET;
  if (type === 'regular') {
    clientIdKey = SecretsKeys.AUTH0_CLIENT;
    secretIdKey = SecretsKeys.AUTH0_SECRET;
  } else if (type === 'messaging') {
    clientIdKey = SecretsKeys.MESSAGING_M2M_CLIENT;
    secretIdKey = SecretsKeys.MESSAGING_M2M_SECRET;
  } else {
    console.log('unknown m2m token type');
    throw Error('unknown m2m token type');
  }
  return getAuth0Token({ secretIdKey, clientIdKey, secrets });
}
