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
import { getParticipantIdFromAppointment } from 'utils';
import { createOystehrClientFromConfig, performEffectWithEnvFile } from './helpers';

const deleteAppointmentData = async (config: any): Promise<void> => {
  const oystehr = await createOystehrClientFromConfig(config);

  const appointmentId = process.argv[3];

  const allResources = await getAppointmentById(oystehr, appointmentId);
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

  console.log('Appointment data batch removed and person patched');
};

const generateDeleteRequestsAndPerson = (
  allResources: FhirResource[]
): [BatchInputDeleteRequest[], Person | undefined] => {
  const deleteRequests: BatchInputDeleteRequest[] = [];

  const person = allResources.filter((resourceTemp) => resourceTemp.resourceType === 'Person')?.[0] as
    | Person
    | undefined;

  const deleteSlotRequests = allResources
    .filter((resourceTemp) => resourceTemp.resourceType === 'Slot')
    .map((slotTemp) => ({ method: 'DELETE', url: `Slot/${slotTemp.id}` })) as BatchInputDeleteRequest[];
  deleteRequests.push(...deleteSlotRequests);

  allResources
    .filter((resourceTemp) => resourceTemp.resourceType === 'Appointment')
    .forEach((appointmentTemp) => {
      const fhirAppointment = appointmentTemp as Appointment;

      if (!fhirAppointment.id) {
        return;
      }

      deleteRequests.push({ method: 'DELETE', url: `/Appointment/${fhirAppointment.id}` });

      const patient = allResources.find(
        (resourceTemp) => resourceTemp.id === getParticipantIdFromAppointment(fhirAppointment, 'Patient')
      );

      if (patient?.id) {
        deleteRequests.push({ method: 'DELETE', url: `/Patient/${patient.id}` });

        (allResources.filter((resourceTemp) => resourceTemp.resourceType === 'Encounter') as Encounter[])
          .filter((encounterTemp) => encounterTemp.subject?.reference === `Patient/${patient.id}`)
          .forEach(
            (encounterTemp) =>
              encounterTemp.id && deleteRequests.push({ method: 'DELETE', url: `/Encounter/${encounterTemp.id}` })
          );

        (allResources.filter((resourceTemp) => resourceTemp.resourceType === 'RelatedPerson') as RelatedPerson[])
          .filter((relatedPersonTemp) => relatedPersonTemp.patient.reference === `Patient/${patient.id}`)
          .forEach((relatedPersonTemp) => {
            if (relatedPersonTemp.id) {
              deleteRequests.push({ method: 'DELETE', url: `/RelatedPerson/${relatedPersonTemp.id}` });
            }
          });

        (
          allResources.filter(
            (resourceTemp) => resourceTemp.resourceType === 'QuestionnaireResponse'
          ) as QuestionnaireResponse[]
        )
          .filter(
            (questionnaireResponseTemp) => questionnaireResponseTemp.subject?.reference === `Patient/${patient.id}`
          )
          .forEach(
            (questionnaireResponseTemp) =>
              questionnaireResponseTemp.id &&
              deleteRequests.push({ method: 'DELETE', url: `/QuestionnaireResponse/${questionnaireResponseTemp.id}` })
          );
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

const getAppointmentById = async (oystehr: Oystehr, appointmentId: string): Promise<FhirResource[]> => {
  const fhirSearchParams: FhirSearchParams<
    Appointment | DocumentReference | Encounter | Patient | RelatedPerson | QuestionnaireResponse | Person
  > = {
    resourceType: 'Appointment',
    params: [
      {
        name: '_id',
        value: appointmentId,
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
    ],
  };

  return (
    await oystehr.fhir.search<
      Appointment | DocumentReference | Encounter | Patient | RelatedPerson | QuestionnaireResponse | Person
    >(fhirSearchParams)
  ).unbundle();
};

const main = async (): Promise<void> => {
  await performEffectWithEnvFile(deleteAppointmentData);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});

// tsx ./scripts/delete-appointment-data.ts <env> <appointmentId>
