import { FhirClient } from '@zapehr/sdk';
import { Patient, Person, RelatedPerson, Resource } from 'fhir/r4';
import { PRIVATE_EXTENSION_BASE_URL } from '../fhir';

// Return true if a new user
export async function createUserResourcesForPatient(
  fhirClient: FhirClient,
  patientID: string,
  phoneNumber: string
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
    telecom: [
      { system: 'phone', value: phoneNumber },
      { system: 'sms', value: phoneNumber },
    ],
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
      `Did find a Person with phone number ${phoneNumber} with ID ${personResults[0].id}, adding RelatedPerson ${relatedPerson.id} to link`
    );
    person = personResults[0];
    const hasLink = person.link;
    if (hasLink) {
      console.log(
        "Person does not have link, this shouldn't happen outside of test cases but is still possible - The account may not have patients"
      );
    }
    const link = {
      target: {
        reference: `RelatedPerson/${relatedPerson.id}`,
      },
    };
    await fhirClient.patchResource({
      resourceType: 'Person',
      resourceId: person.id || '',
      operations: [
        {
          op: 'add',
          path: hasLink ? '/link/0' : '/link',
          value: hasLink ? link : [link],
        },
      ],
    });
    console.log(`Updated Person with ID ${person.id}`);
  }

  return { relatedPerson, person, newUser };
}

export async function getRelatedPersonsForPhoneNumber(
  phoneNumber: string,
  fhirClient: FhirClient
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

export async function getPatientResourceWithVerifiedPhoneNumber(
  patientID: string,
  fhirClient: FhirClient
): Promise<{
  patient: Patient | undefined;
  verifiedPhoneNumber: string | undefined;
  relatedPerson: RelatedPerson | undefined;
}> {
  const response: (Patient | RelatedPerson | Person)[] = await fhirClient.searchResources({
    resourceType: 'Patient',
    searchParams: [
      {
        name: '_id',
        value: patientID,
      },
      {
        name: '_revinclude',
        value: 'RelatedPerson:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'Person:link:RelatedPerson',
      },
    ],
  });

  const patient = response.find((res) => {
    return res.resourceType === 'Patient';
  }) as Patient;

  const person = response.find((res) => {
    return res.resourceType === 'Person';
  }) as Person;

  const relatedPerson = response.find((res) => {
    return res.resourceType === 'RelatedPerson';
  }) as RelatedPerson;

  const contacts = person?.telecom ?? [];

  const verifiedPhoneNumber = contacts.find((contact) => {
    if (contact.system === 'phone' && contact.value) {
      return contact.period?.end == undefined;
    }
    return false;
  })?.value;

  return { patient, verifiedPhoneNumber, relatedPerson };
}
