import Oystehr, { BatchInputDeleteRequest, FhirSearchParams } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Appointment, Coding, FhirResource, Observation, Patient, Person } from 'fhir/r4b';
import { chunkThings, getAllFhirSearchPages } from '../fhir';
import { sleep } from '../helpers';

export const cleanAppointmentGraph = async (tag: Coding, oystehr: Oystehr): Promise<boolean> => {
  const allResources = await getAppointmentGraphByTag(oystehr, tag);

  const [deleteRequests, persons] = generateDeleteRequestsAndPerson(allResources);

  await Promise.all(persons.map((person) => patchPerson(oystehr, person, allResources)));

  try {
    console.log(`Deleting resources...`);
    const chunkedRequests = chunkThings(deleteRequests, 100);
    for (let i = 0; i < chunkedRequests.length; i++) {
      try {
        const result = await oystehr.fhir.transaction({ requests: [...chunkedRequests[i]] });
        console.log(`successfully deleted resources, chunk ${i + 1} of ${chunkedRequests.length}`);
        console.log('delete result:', result?.entry?.[0]?.response?.status);
      } catch (e) {
        console.log(`Error deleting resources, chunk ${i + 1} of ${chunkedRequests.length}: ${e}`, JSON.stringify(e));
        console.log('Continuing with additional requests...');
      }
      await sleep(250);
    }
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

  const personsSoFar = new Set<string>();
  const persons = allResources.filter((resourceTemp) => {
    if (resourceTemp.resourceType === 'Person' && resourceTemp.id && !personsSoFar.has(resourceTemp.id)) {
      personsSoFar.add(resourceTemp.id);
      return true;
    }
    return false;
  }) as Person[];
  const addedSoFar = new Set<string>();
  deleteRequests.push(
    ...allResources.flatMap((resourceTemp) => {
      if (NEVER_DELETE.includes(resourceTemp.resourceType)) {
        return [] as BatchInputDeleteRequest[];
      } else {
        const url = `${resourceTemp.resourceType}/${resourceTemp.id}`;
        if (addedSoFar.has(url)) {
          return [] as BatchInputDeleteRequest[];
        }
        addedSoFar.add(url);
        return [{ method: 'DELETE', url }] as BatchInputDeleteRequest[];
      }
    })
  );

  const deleteMap = [...deleteRequests].reduce(
    (accum, request) => {
      const [resourceType] = request.url.split('/');
      if (resourceType) {
        const currentCount = accum[resourceType] || 0;
        accum[resourceType] = currentCount + 1;
      }
      return accum;
    },
    {} as Record<string, number>
  );
  const deleteSummary = Object.entries(deleteMap)
    .map(([resourceType, count]) => `${resourceType}: ${count}`)
    .join(', \n');
  console.log('Resources to be deleted: ', deleteSummary);

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
      const newLink = (person.link ?? []).filter((linkTemp) => {
        return !relatedPersons.some(
          (relatedPerson) => linkTemp.target?.reference === `RelatedPerson/${relatedPerson.id}`
        );
      });
      operations.push({ op: 'replace', path: '/link', value: newLink });
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
        const personReFetched = (
          await oystehr.fhir.search<Person>({
            resourceType: 'Person',
            params: [{ name: '_id', value: person.id! }],
          })
        ).unbundle()[0];

        if (personReFetched) {
          person.meta!.versionId = personReFetched.meta!.versionId!;
          person.link = personReFetched.link;
        }
      }
    }
  } catch (e) {
    console.error(`Error patching resources: ${e}`, JSON.stringify(e));
  }
};

const getAppointmentGraphByTag = async (
  oystehr: Oystehr,
  tag: Coding,
  includeObservations = false
): Promise<FhirResource[]> => {
  const { system, code } = tag;
  const appointmentSearchParams: FhirSearchParams<Appointment | Patient> = {
    resourceType: 'Appointment',
    params: [
      {
        name: '_tag',
        value: `${system}|${code}`,
      },
      {
        name: '_sort',
        value: '-_lastUpdated',
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
        name: '_revinclude',
        value: 'Task:focus',
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
        value: 'ClinicalImpression:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'AuditEvent:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'ServiceRequest:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'DiagnosticReport:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'Specimen:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'Account:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'Coverage:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'MedicationRequest:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'Procedure:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'Task:based-on',
      },
      {
        name: '_revinclude:iterate',
        value: 'Task:encounter',
      },
    ],
  };

  // we limit the matches per search to 20 because the include list is very large and we want to avoid swelling the overall
  // response size to the point that it exceeds the API Gateway limits
  const allResources = await getAllFhirSearchPages(appointmentSearchParams, oystehr, 10);
  const allPatientRefs = allResources
    .filter((resourceTemp) => resourceTemp.resourceType === 'Patient')
    .map((p) => `Patient/${p.id}`);

  const allObservations: Observation[] = [];

  if (includeObservations) {
    const chunksOfPatients = chunkThings(allPatientRefs, 50);

    for (const chunk of chunksOfPatients) {
      const chunkParams = [{ name: 'patient', value: chunk.join(',') }];
      const chunkObservations = await getAllFhirSearchPages<Observation>(
        { resourceType: 'Observation', params: chunkParams },
        oystehr
      );
      allObservations.push(...chunkObservations);
    }
    console.log(`Found ${allResources.length} non-observation resources and ${allObservations.length} observations`);
  } else {
    console.log(`Found ${allResources.length} resources to delete`);
  }
  const beforeDedupe = [...allResources, ...allObservations];

  const startLength = beforeDedupe.length;

  const resourceIdSet = new Set<string>();
  const dedupedResources = beforeDedupe.filter((resource) => {
    const key = `${resource.resourceType}/${resource.id}`;
    if (resourceIdSet.has(key)) {
      return false;
    }
    resourceIdSet.add(key);
    return true;
  });
  const dedupedLength = dedupedResources.length;
  console.log(`Removed ${startLength - dedupedLength} duplicate resources`);
  return dedupedResources;
};
