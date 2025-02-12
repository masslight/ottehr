import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import {
  Appointment,
  DocumentReference,
  Encounter,
  FhirResource,
  Patient,
  QuestionnaireResponse,
  RelatedPerson,
} from 'fhir/r4b';
import { getParticipantIdFromAppointment } from 'utils';
import { performEffectWithEnvFile } from 'zambda-utils';
import { createOystehrClientFromConfig } from './helpers';

const deleteAppointmentData = async (config: any): Promise<void> => {
  const oystehr = await createOystehrClientFromConfig(config);

  const appointmentId = process.argv[3];

  const allResources = await getAppointmentById(oystehr, appointmentId);
  const deleteRequests = generateDeleteRequests(allResources);

  const result = await oystehr.fhir.transaction({ requests: deleteRequests });

  console.log('Appointment data deleted', JSON.stringify(result, null, 2));
};

const generateDeleteRequests = (allResources: FhirResource[]): BatchInputDeleteRequest[] => {
  const deleteRequests: BatchInputDeleteRequest[] = [];

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
            (relatedPersonTemp) =>
              relatedPersonTemp.id &&
              deleteRequests.push({ method: 'DELETE', url: `/RelatedPerson/${relatedPersonTemp.id}` })
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

  return deleteRequests;
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
    ],
  };

  return (
    await oystehr.fhir.search<
      Appointment | DocumentReference | Encounter | Patient | RelatedPerson | QuestionnaireResponse
    >(fhirSearchParams)
  ).unbundle();
};

const main = async (): Promise<void> => {
  await performEffectWithEnvFile('intake', deleteAppointmentData);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});

// tsx ./scripts/delete-appointment-data.ts <env> <appointmentId>
