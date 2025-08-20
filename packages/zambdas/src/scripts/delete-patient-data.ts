import Oystehr, { BatchInputDeleteRequest, FhirSearchParams } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import {
  Appointment,
  DocumentReference,
  Encounter,
  FhirResource,
  Patient,
  Person,
  QuestionnaireResponse,
  RelatedPerson,
} from 'fhir/r4b';
import { createOystehrClientFromConfig, performEffectWithEnvFile } from './helpers';

const deletePatientData = async (config: any): Promise<void> => {
  const oystehr = await createOystehrClientFromConfig(config);

  const patientId = process.argv[3];

  const allResources = await getPatientById(oystehr, patientId);
  const [deleteRequests, person] = generateDeleteRequestsAndPerson(allResources);

  try {
    console.log(`Deleting resources...`);
    await oystehr.fhir.batch({ requests: [...deleteRequests] });
  } catch (e) {
    console.log(`Error deleting resources: ${e}`, JSON.stringify(e));
  } finally {
    console.log(`Deleting resources complete`);
  }

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
        const personNewlyFetched = (
          await oystehr.fhir.search<Person>({
            resourceType: 'Person',
            params: [{ name: '_id', value: person.id! }],
          })
        ).unbundle()[0];

        if (personNewlyFetched) {
          person.meta!.versionId = personNewlyFetched.meta!.versionId!;
          person.link = personNewlyFetched.link;
        }
      }
    }
  } catch (e) {
    console.error(`Error patching resources: ${e}`, JSON.stringify(e));
  }

  console.log('Appointment data batch removed and person patched');
};

const generateDeleteRequestsAndPerson = (
  allResources: FhirResource[]
): [BatchInputDeleteRequest[], Person | undefined] => {
  const deleteRequests: BatchInputDeleteRequest[] = [];

  const person = allResources.filter((resourceTemp) => resourceTemp.resourceType === 'Person')?.[0] as
    | Person
    | undefined;

  allResources
    .filter((resourceTemp) => resourceTemp.resourceType === 'Patient')
    .forEach((patientTemp) => {
      const fhirPatient = patientTemp as Patient;

      if (!fhirPatient.id) {
        return;
      }

      deleteRequests.push({ method: 'DELETE', url: `/Patient/${fhirPatient.id}` });

      if (fhirPatient?.id) {
        deleteRequests.push({ method: 'DELETE', url: `/Patient/${fhirPatient.id}` });

        (allResources.filter((resourceTemp) => resourceTemp.resourceType === 'RelatedPerson') as RelatedPerson[])
          .filter((relatedPersonTemp) => relatedPersonTemp.patient.reference === `Patient/${fhirPatient.id}`)
          .forEach((relatedPersonTemp) => {
            if (relatedPersonTemp.id) {
              deleteRequests.push({ method: 'DELETE', url: `/RelatedPerson/${relatedPersonTemp.id}` });
            }
          });
      }
    });

  console.log('Resources to be deleted:');
  deleteRequests.forEach((request) => {
    const [resourceType, id] = request.url.slice(1).split('/');
    console.log(`${resourceType}: ${id}`);
  });

  if (person) {
    console.log(`Person to be patched: ${person.resourceType}: ${person.id}`);
  } else {
    console.log('No Person resource found');
  }

  return [deleteRequests, person];
};

const getPatientById = async (oystehr: Oystehr, patientId: string): Promise<FhirResource[]> => {
  const fhirSearchParams: FhirSearchParams<DocumentReference | Patient | RelatedPerson | Person> = {
    resourceType: 'Patient',
    params: [
      {
        name: '_id',
        value: patientId,
      },
      {
        name: '_revinclude:iterate',
        value: 'DocumentReference:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'Person:relatedperson',
      },
    ],
  };

  return (
    await oystehr.fhir.search<
      Appointment | DocumentReference | Encounter | Patient | RelatedPerson | QuestionnaireResponse | Person
    >(fhirSearchParams)
  ).unbundle();
};

const main = async (): Promise<void> => {
  await performEffectWithEnvFile(deletePatientData);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});

// tsx ./scripts/delete-appointment-data.ts <env> <appointmentId>
