import Oystehr, { BatchInputDeleteRequest, FhirPatchParams } from '@oystehr/sdk';
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
  const [deleteRequests, updateRequests] = generateDeleteRequestsAndUpdateOps(allResources);

  try {
    
  console.log(`Deleting resources...`);
  await oystehr.fhir.batch({ requests: [...deleteRequests] });
  } catch (e) {
    console.log(`Error deleting resources: ${e}`, JSON.stringify(e));
  }
  finally {
    console.log(`Deleting resources complete`);
  }

  const patchResults: any[] = [];

  try {
    console.log(`Patching resources...`);
    for (const patchParam of updateRequests) {
      let retries = 0;
      while (retries < 10) {
        try {
          const patchResult = await oystehr.fhir.patch(patchParam, { optimisticLockingVersionId: patchParam.optimisticLockingVersionId });
          if (patchResult) {
            patchResults.push(patchResult);
          }
          break;
        } catch (e) {
          console.error(`Error patching resource: ${e}`, JSON.stringify(e));
          retries++;
          await new Promise((resolve) => setTimeout(resolve, 200));
          const patchResource = (await oystehr.fhir.search({
            resourceType: patchParam.resourceType,
            params: [{ name: '_id', value: patchParam.id }],
          })).unbundle()[0];

          if (patchResource) {
            patchParam.id = patchResource.id!;
            patchParam.optimisticLockingVersionId = patchResource.meta!.versionId!;
          }
        }
      }
    }
  } catch (e) {
    console.error(`Error patching resources: ${e}`, JSON.stringify(e));
  }
  finally {
    console.log(`Patching resources complete`);
  }

  if (patchResults.length !== updateRequests.length) {
    throw new Error(`Patching resources failed. Patch results: ${JSON.stringify(patchResults)}`);
  }

  console.log('Appointment data batch removed and person patched');
};

const generateDeleteRequestsAndUpdateOps = (allResources: FhirResource[]): [BatchInputDeleteRequest[], (FhirPatchParams & { optimisticLockingVersionId: string })[]] => {
  const deleteRequests: BatchInputDeleteRequest[] = [];
  const patchParams: (FhirPatchParams & { optimisticLockingVersionId: string })[] = [];

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
                  patchParams.push({resourceType: 'Person', id: person?.id!, operations, optimisticLockingVersionId: person?.meta?.versionId!});
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

  console.log('Resources to be patched:');
  patchParams.forEach((patchParam) => {
    console.log(`${patchParam.resourceType}: ${patchParam.id}`);
  });

  return [deleteRequests, patchParams];
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
