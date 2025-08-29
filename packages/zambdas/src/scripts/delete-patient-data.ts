import Oystehr, { BatchInputDeleteRequest, FhirSearchParams } from '@oystehr/sdk';
import { Appointment, DocumentReference, Encounter, FhirResource, Patient, Person, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { chunkThings, getAllFhirSearchPages, NEVER_DELETE } from 'utils';

const CHUNK_SIZE = 50;
// in this script, deleting RelatedPersons is expected
const NEVER_DELETE_TYPES = NEVER_DELETE.filter((type) => type !== 'Person');

export const deletePatientData = async (
  oystehr: Oystehr,
  patientId: string,
  cutOffDate: DateTime
): Promise<{ patients: number; otherResources: number }> => {
  const allResources = await getPatientAndResourcesById(oystehr, patientId, cutOffDate);
  if (allResources.length === 0) {
    return { patients: 0, otherResources: 0 };
  }

  const deleteRequests = generateDeleteRequests(allResources);

  let patientDeleteCount = 0;
  // forEach doesn't respect await https://sentry.io/answers/are-there-any-issues-with-using-async-await-with-foreach-loops-in-javascript/
  for (let i = 0; i < deleteRequests.length; i++) {
    const requestGroup = deleteRequests[i];
    try {
      console.log('Deleting resources chunk', i + 1, 'of', deleteRequests.length);
      await oystehr.fhir.batch({ requests: requestGroup });
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (e: unknown) {
      console.log(`Error deleting resources: ${e}`, JSON.stringify(e));
      console.log('patient id', patientId);
    } finally {
      console.log('Deleting resources chunk', i + 1, 'of', deleteRequests.length, 'complete');
    }
    patientDeleteCount += requestGroup.filter((request) => request.url.startsWith('/Patient')).length;
  }

  return {
    patients: patientDeleteCount,
    otherResources: deleteRequests.map((group) => group.length).reduce((acc, curr) => acc + curr) - patientDeleteCount,
  };
};

const generateDeleteRequests = (allResources: FhirResource[]): BatchInputDeleteRequest[][] => {
  const deleteRequests: BatchInputDeleteRequest[] = allResources
    .map((resource) => {
      if (!resource.id || NEVER_DELETE_TYPES.includes(resource.resourceType)) {
        console.log('excluding', `${resource.resourceType}/${resource.id}`);
        return;
      }
      return { method: 'DELETE' as const, url: `/${resource.resourceType}/${resource.id}` };
    })
    .filter((request) => request !== undefined);

  const patientDeleteRequest = deleteRequests.filter((request) => request.url.startsWith('/Patient'));
  const nonObservationDeleteRequests = chunkThings(
    deleteRequests.filter((request) => !request.url.startsWith('/Observation') && !request.url.startsWith('/Patient')),
    CHUNK_SIZE
  );
  const observationDeleteRequests = chunkThings(
    deleteRequests.filter((request) => request.url.startsWith('/Observation')),
    CHUNK_SIZE
  );
  // delete patient last in case of timeouts
  return [...observationDeleteRequests, ...nonObservationDeleteRequests, patientDeleteRequest];
};

const getPatientAndResourcesById = async (
  oystehr: Oystehr,
  patientId: string,
  cutOffDate: DateTime
): Promise<FhirResource[]> => {
  const fhirSearchParams: FhirSearchParams<
    DocumentReference | Patient | RelatedPerson | Person | Appointment | Encounter
  > = {
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
        value: 'Appointment:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'Encounter:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'Communication:patient',
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
        value: 'Consent:patient',
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
        name: '_revinclude',
        value: 'List:subject',
      },
      {
        name: '_revinclude:iterate',
        value: 'Person:relatedperson',
      },
      {
        name: '_revinclude:iterate',
        value: 'Encounter:appointment',
      },
      {
        name: '_revinclude:iterate',
        value: 'QuestionnaireResponse:encounter',
      },
      // if lots of batch deletes fail, it's probably because of observations. comment this out if so.
      {
        name: '_revinclude:iterate',
        value: 'Observation:encounter',
      },
      {
        name: '_revinclude:iterate',
        value: 'ServiceRequest:encounter',
      },
      {
        name: '_revinclude:iterate',
        value: 'ClinicalImpression:encounter',
      },
      {
        name: '_revinclude:iterate',
        value: 'Task:encounter',
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
        value: 'Task:based-on',
      },
      {
        name: '_revinclude',
        value: 'Task:focus',
      },
      {
        name: '_include',
        value: 'ServiceRequest:specimen',
      },
    ],
  };

  let allResources: FhirResource[] = [];
  try {
    allResources = await getAllFhirSearchPages(fhirSearchParams, oystehr, 10);
  } catch (error: unknown) {
    console.log(`Error fetching resources: ${error}`, JSON.stringify(error));
    if (error instanceof Oystehr.OystehrSdkError && error.code === 4130) {
      // if it fails because of the 6Mb limit, try splitting the request into more pages
      try {
        allResources = await getAllFhirSearchPages(fhirSearchParams, oystehr, 5);
      } catch (error: unknown) {
        console.log(`Error fetching resources: ${error}`, JSON.stringify(error));
        return [];
      }
    }
    return [];
  }

  // if there are no appointments or encounters, delete this patient
  if (
    !allResources.some((resource) => resource.resourceType === 'Appointment' || resource.resourceType === 'Encounter')
  ) {
    return allResources;
  }

  const appointments = allResources.filter((resource) => resource.resourceType === 'Appointment') as Appointment[];
  // no start times = walk-ins so assume last updated date is walk-in time
  const startTimes = appointments
    .map((appointment) => appointment.start || appointment.meta?.lastUpdated)
    .filter((time) => time !== undefined);
  const hasRecentAppointments = startTimes.some((startTime) => {
    const appointmentStart = DateTime.fromISO(startTime);
    return appointmentStart >= cutOffDate;
  });
  if (hasRecentAppointments) {
    console.log('Patient has recent appointments, skipping');
    return [];
  }

  return allResources;
};
