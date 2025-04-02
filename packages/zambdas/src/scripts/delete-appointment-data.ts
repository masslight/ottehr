import Oystehr, { BatchInputDeleteRequest, BatchInputPatchRequest } from '@oystehr/sdk';
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
  const [deleteRequests, updateRequests] = generateDeleteAndUpdateRequests(allResources);

  await oystehr.fhir.batch({ requests: [...deleteRequests,...updateRequests] });

  console.log('Appointment data batch removed and person updated');
};

const generateDeleteAndUpdateRequests = (allResources: FhirResource[]): [BatchInputDeleteRequest[], BatchInputPatchRequest<Person>[]] => {
  const deleteRequests: BatchInputDeleteRequest[] = [];
  const updateRequests: BatchInputPatchRequest<Person>[] = [];

  const person = allResources.filter((resourceTemp) => resourceTemp.resourceType === 'Person')?.[0] as Person;

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
          .forEach(
            (relatedPersonTemp) => {
              if (relatedPersonTemp.id) {
                deleteRequests.push({ method: 'DELETE', url: `/RelatedPerson/${relatedPersonTemp.id}` });
                const linkIndex = person?.link?.findIndex((linkTemp) => linkTemp.target?.reference === `RelatedPerson/${relatedPersonTemp.id}`) || -1;
                if (linkIndex >= 0) {
                  const operations: Operation[] = [];
                  if (person?.link?.length === 1) {
                    operations.push({ op: 'remove', path: '/link' });
                  } else {
                    operations.push({ op: 'remove', path: `/link/${linkIndex}` });
                  }
                  updateRequests.push({method: 'PATCH', url: `/Person/${person?.id}`, operations});
                }
              }
            }
          );

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

  console.log('Resources to be updated:');
  updateRequests.forEach((request) => {
    const [resourceType, id] = request.url.slice(1).split('/');
    console.log(`${resourceType}: ${id}`);
  });

  return [deleteRequests, updateRequests];
};

const getAppointmentById = async (oystehr: Oystehr, appointmentId: string): Promise<FhirResource[]> => {
  const fhirSearchParams = {
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
