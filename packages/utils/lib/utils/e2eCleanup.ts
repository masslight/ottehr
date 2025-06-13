import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Coding, FhirResource, Person } from 'fhir/r4b';

export const cleanAppointmentGraph = async (tag: Coding, oystehr: Oystehr): Promise<boolean> => {
  const allResources = await getAppointmentGraphByTag(oystehr, tag);
  const [deleteRequests, persons] = generateDeleteRequestsAndPerson(allResources);

  console.log('deleteRequests length:', deleteRequests.length);

  await Promise.all(persons.map((person) => patchPerson(oystehr, person, allResources)));

  try {
    console.log(`Deleting resources...`);
    const transaction = await oystehr.fhir.transaction({ requests: [...deleteRequests] });
    console.log(`Transaction response:`, JSON.stringify(transaction, null, 2));
    return true;
  } catch (e) {
    console.log(`Error deleting resources: ${e}`, JSON.stringify(e));
    return false;
  }
};

// these things are important environment infra rather than ephemeral test data, so leave them alone
const NEVER_DELETE = [
  'Person',
  'Location',
  'Schedule',
  'Organization',
  'Practitioner',
  'PractitionerRole',
  'HealthcareService',
];

const generateDeleteRequestsAndPerson = (allResources: FhirResource[]): [BatchInputDeleteRequest[], Person[]] => {
  const deleteRequests: BatchInputDeleteRequest[] = [];

  const persons = allResources.filter((resourceTemp) => resourceTemp.resourceType === 'Person') as Person[];

  deleteRequests.push(
    ...allResources.flatMap((resourceTemp) => {
      if (NEVER_DELETE.includes(resourceTemp.resourceType)) {
        return [] as BatchInputDeleteRequest[];
      } else {
        return { method: 'DELETE', url: `${resourceTemp.resourceType}/${resourceTemp.id}` } as BatchInputDeleteRequest;
      }
    })
  );

  console.log('Resources to be deleted:');
  deleteRequests.forEach((request) => {
    const [resourceType, id] = request.url.slice(1).split('/');
    console.log(`${resourceType}: ${id}`);
  });

  if (persons) {
    console.log(`Persons to be patched: ${persons.map((p) => `Person/${p.id}`).join(', ')}`);
  } else {
    console.log('No Person resource found');
  }

  return [deleteRequests, persons];
};

const patchPerson = async (oystehr: Oystehr, person: Person, allResources: FhirResource[]): Promise<void> => {
  if (!person) {
    return;
  }

  try {
    console.log(`Patching Person...`);

    const relatedPersons = allResources.filter((resourceTemp) => resourceTemp.resourceType === 'RelatedPerson');

    let retries = 0;
    while (retries < 20) {
      const operations: Operation[] = [];
      for (const relatedPerson of relatedPersons) {
        const linkIndex =
          person?.link?.findIndex((linkTemp) => linkTemp.target?.reference === `RelatedPerson/${relatedPerson.id}`) ||
          -1;
        if (linkIndex >= 0) {
          if (person?.link?.length === 1) {
            operations.push({ op: 'remove', path: '/link' });
          } else {
            operations.push({ op: 'remove', path: `/link/${linkIndex}` });
          }
        } else {
          console.log(`RelatedPerson/${relatedPerson.id} link not found in Person ${person?.id}`);
        }
      }
      try {
        if (operations.length > 0) {
          await oystehr.fhir.patch<Person>(
            { resourceType: 'Person', id: person.id!, operations },
            { optimisticLockingVersionId: person.meta!.versionId! }
          );
        } else {
          console.log(`No operations to patch Person/${person.id}`);
          break;
        }
        console.log(`Patching Person complete`);

        break;
      } catch (e) {
        console.error(`Error patching resource: ${e}`, JSON.stringify(e));
        retries++;
        await new Promise((resolve) => setTimeout(resolve, 200));
        const personRefetched = (
          await oystehr.fhir.search<Person>({
            resourceType: 'Person',
            params: [{ name: '_id', value: person.id! }],
          })
        ).unbundle()[0];

        if (personRefetched) {
          person.meta!.versionId = personRefetched.meta!.versionId!;
          person.link = personRefetched.link;
        }
      }
    }
  } catch (e) {
    console.error(`Error patching resources: ${e}`, JSON.stringify(e));
  }
};

const getAppointmentGraphByTag = async (oystehr: Oystehr, tag: Coding): Promise<FhirResource[]> => {
  const { system, code } = tag;
  const fhirSearchParams = {
    resourceType: 'Appointment',
    params: [
      {
        name: '_tag',
        value: `${system}|${code}`,
      },
      {
        name: '_include',
        value: 'Appointment:patient',
      },
      {
        name: '_include',
        value: 'Appointment:slot',
      },
      {
        name: '_include',
        value: 'Appointment:location',
      },
      {
        name: '_revinclude:iterate',
        value: 'RelatedPerson:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'Encounter:participant',
      },
      {
        name: '_revinclude:iterate',
        value: 'Encounter:appointment',
      },
      {
        name: '_revinclude:iterate',
        value: 'DocumentReference:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'QuestionnaireResponse:encounter',
      },
      {
        name: '_revinclude:iterate',
        value: 'Person:relatedperson',
      },
      {
        name: '_revinclude:iterate',
        value: 'Communication:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'MedicationAdministration:context',
      },
      {
        name: '_revinclude:iterate',
        value: 'MedicationStatement:part-of',
      },
      {
        name: '_revinclude:iterate',
        value: 'Account:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'Coverage:patient',
      },
    ],
  };

  return (await oystehr.fhir.search<FhirResource>(fhirSearchParams)).unbundle();
};
